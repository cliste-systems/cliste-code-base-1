"use client";

import { useCallback, useEffect, useState } from "react";

import {
  filterActiveIncomingCallPlaceholders,
  type CallsIncomingPlaceholder,
  upsertIncomingCallPlaceholder,
} from "@/lib/calls-incoming-placeholder";
import {
  DASHBOARD_INCOMING_CALL_EVENT,
  type DashboardIncomingCallDetail,
} from "@/lib/dashboard-live-events";
import { createClient } from "@/utils/supabase/client";

const MAX_LIVE_CALLS = 5;
const PLACEHOLDER_TIMEOUT_MS = 120_000;

function readStringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function incomingDetailFromUsageRecord(
  row: Record<string, unknown>,
): DashboardIncomingCallDetail {
  return {
    phase: "in_progress",
    callerNumber: readStringField(row, "caller_number"),
    startedAt: readStringField(row, "started_at") ?? new Date().toISOString(),
    usageRecordId: readStringField(row, "id"),
  };
}

function incomingDetailFromCallLog(
  row: Record<string, unknown>,
): DashboardIncomingCallDetail {
  return {
    phase: "loading",
    callLogId: readStringField(row, "id"),
    callerNumber: readStringField(row, "caller_number"),
    startedAt: readStringField(row, "created_at") ?? new Date().toISOString(),
  };
}

type UseHomeLiveIncomingCallsOptions = {
  organizationId: string;
  activityCalls: ReadonlyArray<{ id: string; createdAt: string }>;
};

export function useHomeLiveIncomingCalls({
  organizationId,
  activityCalls,
}: UseHomeLiveIncomingCallsOptions): CallsIncomingPlaceholder[] {
  const [placeholders, setPlaceholders] = useState<CallsIncomingPlaceholder[]>([]);

  const applyIncomingDetail = useCallback((detail: DashboardIncomingCallDetail) => {
    if (!detail.phase) return;
    setPlaceholders((current) =>
      upsertIncomingCallPlaceholder(current, detail).slice(0, MAX_LIVE_CALLS),
    );
  }, []);

  useEffect(() => {
    const onIncomingCall = (event: Event) => {
      const detail = (event as CustomEvent<DashboardIncomingCallDetail>).detail;
      applyIncomingDetail(detail);
    };

    window.addEventListener(DASHBOARD_INCOMING_CALL_EVENT, onIncomingCall);
    return () => {
      window.removeEventListener(DASHBOARD_INCOMING_CALL_EVENT, onIncomingCall);
    };
  }, [applyIncomingDetail]);

  useEffect(() => {
    if (!organizationId.trim()) {
      setPlaceholders([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("usage_records")
        .select("id, caller_number, started_at")
        .eq("organization_id", organizationId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(MAX_LIVE_CALLS);

      if (cancelled || !data?.length) return;

      setPlaceholders((current) => {
        let next = current;
        for (const row of data) {
          const detail = incomingDetailFromUsageRecord(row as Record<string, unknown>);
          next = upsertIncomingCallPlaceholder(next, detail);
        }
        return next.slice(0, MAX_LIVE_CALLS);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    setPlaceholders((current) =>
      filterActiveIncomingCallPlaceholders(current, activityCalls).slice(
        0,
        MAX_LIVE_CALLS,
      ),
    );
  }, [activityCalls]);

  useEffect(() => {
    if (!organizationId.trim()) return;

    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`home-live-calls-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "usage_records",
          filter,
        },
        (payload) => {
          applyIncomingDetail(incomingDetailFromUsageRecord(payload.new));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "usage_records",
          filter,
        },
        (payload) => {
          const endedAt = readStringField(payload.new as Record<string, unknown>, "ended_at");
          if (!endedAt) return;

          const usageRecordId = readStringField(payload.new as Record<string, unknown>, "id");
          const startedAt = readStringField(payload.new as Record<string, unknown>, "started_at");
          setPlaceholders((current) =>
            current.filter((placeholder) => {
              if (usageRecordId && placeholder.usageRecordId === usageRecordId) {
                return false;
              }
              if (startedAt && placeholder.startedAt === startedAt && !placeholder.callLogId) {
                return false;
              }
              return true;
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_logs",
          filter,
        },
        (payload) => {
          applyIncomingDetail(incomingDetailFromCallLog(payload.new));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyIncomingDetail, organizationId]);

  useEffect(() => {
    if (placeholders.length === 0) return;

    const timeout = window.setTimeout(() => {
      setPlaceholders((current) => {
        const cutoff = Date.now() - PLACEHOLDER_TIMEOUT_MS;
        return current.filter(
          (placeholder) => new Date(placeholder.startedAt).getTime() >= cutoff,
        );
      });
    }, PLACEHOLDER_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [placeholders]);

  return placeholders;
}
