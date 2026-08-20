"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardHomeCardsGrid } from "@/components/dashboard/dashboard-home-cards-grid";
import { DashboardHomeEnter } from "@/components/dashboard/dashboard-home-enter";
import { DashboardHomeHero } from "@/components/dashboard/dashboard-home-hero";
import type { DashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";
import { createClient } from "@/utils/supabase/client";

const REALTIME_DEBOUNCE_MS = 250;
/** Re-fetch for relative timestamps ("4 mins ago" → "5 mins ago"). */
const RELATIVE_TIME_TICK_MS = 30_000;
/** Fallback poll when Realtime is unavailable. */
const FALLBACK_POLL_MS = 8_000;

type DashboardHomeLiveProps = {
  organizationId: string;
  metricRange: DashboardMetricRangeKey;
  initialSnapshot: DashboardHomeSnapshot;
  heroClassName?: string;
  cardsClassName?: string;
  enterClassName?: string;
};

export function DashboardHomeLive({
  organizationId,
  metricRange,
  initialSnapshot,
  heroClassName,
  cardsClassName,
  enterClassName,
}: DashboardHomeLiveProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const realtimeHealthyRef = useRef(false);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const fetchSnapshot = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/dashboard/home?range=${encodeURIComponent(metricRange)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const next = (await res.json()) as DashboardHomeSnapshot;
      setSnapshot(next);
    } finally {
      inFlightRef.current = false;
    }
  }, [metricRange]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void fetchSnapshot();
      router.refresh();
    }, REALTIME_DEBOUNCE_MS);
  }, [fetchSnapshot, router]);

  useEffect(() => {
    if (!organizationId) return;

    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`dashboard-home-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_logs", filter },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_logs", filter },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "action_tickets", filter },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "action_tickets", filter },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cara_training_items",
          filter,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cara_training_items",
          filter,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "usage_records", filter },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "usage_records", filter },
        scheduleRefresh,
      )
      .subscribe((status) => {
        realtimeHealthyRef.current = status === "SUBSCRIBED";
      });

    const relativeTick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchSnapshot();
    }, RELATIVE_TIME_TICK_MS);

    const fallbackPoll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (realtimeHealthyRef.current) return;
      void fetchSnapshot();
    }, FALLBACK_POLL_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(relativeTick);
      clearInterval(fallbackPoll);
      supabase.removeChannel(channel);
    };
  }, [organizationId, fetchSnapshot, scheduleRefresh]);

  return (
    <DashboardHomeEnter className={enterClassName}>
      <DashboardHomeHero
        className={heroClassName}
        greeting={snapshot.greeting}
        subheading={snapshot.subheading}
        stats={snapshot.stats}
      />

      <DashboardHomeCardsGrid
        className={cardsClassName}
        activity={snapshot.activity}
        needsAttention={snapshot.needsAttention}
        openActions={snapshot.openActions}
        caraTraining={snapshot.caraTraining}
        openTrainingCount={snapshot.openTrainingCount}
        caraPerformance={snapshot.caraPerformance}
        requestTypeSegments={snapshot.requestTypeSegments}
        callOutcomeSegments={snapshot.callOutcomeSegments}
        callTimes={snapshot.callTimes}
      />
    </DashboardHomeEnter>
  );
}
