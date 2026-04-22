"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { createClient } from "@/utils/supabase/client";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Fallback polling when Realtime is unavailable or tables aren’t in the
 * `supabase_realtime` publication. Realtime is the primary path — the three
 * activity tables are added in migration
 * `034_realtime_publication_activity_tables.sql`, so events arrive in <1s
 * — and polling is a safety net for the dashboards where activity data is
 * actively rendered.
 *
 * Why so infrequent? Each `router.refresh()` re-runs the dashboard layout
 * + page server render — that's ~10+ Supabase queries on the home page
 * alone. At a tight cadence the dashboard always *feels* like it's
 * "loading" because a fresh re-fetch is permanently in flight.
 */
const POLL_INTERVAL_MS = IS_DEV ? 60_000 : 45_000;

/** Coalesce interval + focus refreshes so RSC fetches don’t overlap. */
const MIN_MS_BETWEEN_POLL_REFRESH = 8_000;

/**
 * Realtime is event-driven (no cost unless data actually changes) and the
 * sidebar badges live on every dashboard page, so we subscribe everywhere
 * under `/dashboard`. The only exclusion is `/dashboard/set-password`,
 * where the session is mid-bootstrap and we don't want stray refreshes.
 */
function shouldEnableRealtime(pathname: string | null): boolean {
  if (!pathname?.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/dashboard/set-password")) return false;
  return true;
}

/**
 * Polling re-renders the layout on a timer regardless of whether anything
 * changed, so keep it scoped to pages that actually display the activity
 * streams. Other pages still update instantly via Realtime.
 */
function shouldPoll(pathname: string | null): boolean {
  if (!shouldEnableRealtime(pathname)) return false;
  // `shouldEnableRealtime` already verified `pathname` starts with
  // "/dashboard", so it can't be null here — re-assert for TS.
  if (!pathname) return false;
  if (pathname === "/dashboard/settings") return false;
  if (pathname === "/dashboard") return true;
  const prefixes = [
    "/dashboard/bookings",
    "/dashboard/calendar",
    "/dashboard/call-history",
    "/dashboard/action-inbox",
    "/dashboard/clients",
    "/dashboard/support",
  ];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

type DashboardLiveRefreshProps = {
  organizationId: string;
};

/**
 * Keeps the dashboard current: Supabase Realtime on relevant tables (near–instant
 * when enabled in the project), plus timed `router.refresh()` as a safety net.
 */
export function DashboardLiveRefresh({
  organizationId,
}: DashboardLiveRefreshProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Seeded inside the mount effect below — `Date.now()` during render
  // would violate react-hooks/purity. 0 is fine pre-mount because the
  // focus listener doesn't attach until then either.
  const lastPollRefreshAt = useRef(0);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const pollRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }
    const now = Date.now();
    if (now - lastPollRefreshAt.current < MIN_MS_BETWEEN_POLL_REFRESH) {
      return;
    }
    lastPollRefreshAt.current = now;
    router.refresh();
  }, [router]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      realtimeDebounceRef.current = null;
      lastPollRefreshAt.current = Date.now();
      router.refresh();
    }, 400);
  }, [router]);

  useEffect(() => {
    if (!shouldPoll(pathname)) return;
    // Don't kick off an immediate refresh on mount — the page just rendered,
    // any data older than the request itself is fine for the first 45-60s.
    // Seed lastPollRefreshAt so the focus-throttle treats mount as "fresh".
    lastPollRefreshAt.current = Date.now();
    const t = setInterval(pollRefresh, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [pathname, pollRefresh]);

  useEffect(() => {
    if (!shouldPoll(pathname)) return;
    // Skip focus/visibility refreshes if the data is fresh enough. Avoids
    // re-rendering the entire dashboard every time the user switches tabs.
    const FOCUS_REFRESH_THRESHOLD_MS = 30_000;
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastPollRefreshAt.current < FOCUS_REFRESH_THRESHOLD_MS) {
        return;
      }
      pollRefresh();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
    };
  }, [pathname, pollRefresh]);

  useEffect(() => {
    if (!organizationId) return;
    if (!shouldEnableRealtime(pathname)) return;

    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`dashboard-activity-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_logs",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "action_tickets",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "action_tickets",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter,
        },
        scheduleRealtimeRefresh,
      )
      .subscribe((status) => {
        if (IS_DEV && status === "CHANNEL_ERROR") {
          console.warn(
            "[DashboardLiveRefresh] Realtime error — enable Realtime and add call_logs, action_tickets, appointments to the publication in Supabase; polling still applies.",
          );
        }
      });

    return () => {
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [organizationId, pathname, scheduleRealtimeRefresh]);

  return null;
}
