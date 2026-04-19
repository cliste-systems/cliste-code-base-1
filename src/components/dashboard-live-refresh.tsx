"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { createClient } from "@/utils/supabase/client";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Fallback polling when Realtime is unavailable or tables aren’t in the
 * `supabase_realtime` publication. Realtime is the primary path (events
 * arrive in <1s); polling is a safety net only, so it can be slow.
 *
 * Why so infrequent? Each `router.refresh()` re-runs the dashboard layout
 * + page server render — that's ~10+ Supabase queries on the home page
 * alone. At a tight cadence the dashboard always *feels* like it's
 * "loading" because a fresh re-fetch is permanently in flight.
 */
const POLL_INTERVAL_MS = IS_DEV ? 60_000 : 45_000;

/** Coalesce interval + focus refreshes so RSC fetches don’t overlap. */
const MIN_MS_BETWEEN_POLL_REFRESH = 8_000;

function shouldSoftRefresh(pathname: string | null): boolean {
  if (!pathname?.startsWith("/dashboard")) return false;
  if (
    pathname === "/dashboard/settings" ||
    pathname.startsWith("/dashboard/set-password")
  ) {
    return false;
  }
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
  // Seed with mount time so focus-on-tab-back doesn't immediately re-fetch.
  const lastPollRefreshAt = useRef(Date.now());
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
    if (!shouldSoftRefresh(pathname)) return;
    // Don't kick off an immediate refresh on mount — the page just rendered,
    // any data older than the request itself is fine for the first 45-60s.
    const t = setInterval(pollRefresh, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [pathname, pollRefresh]);

  useEffect(() => {
    if (!shouldSoftRefresh(pathname)) return;
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
    if (!shouldSoftRefresh(pathname)) return;

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
