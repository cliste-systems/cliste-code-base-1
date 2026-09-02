import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardCallRangeMetrics = {
  totalCalls: number;
  routedCount: number;
  avgDurationSeconds: number;
  totalDurationSeconds: number;
};

export type DashboardCallOutcomeCount = {
  outcome: string;
  callCount: number;
};

export async function fetchDashboardCallRangeMetrics(
  supabase: SupabaseClient,
  organizationIds: string[],
  lowerIso: string,
  upperIso: string | null,
): Promise<DashboardCallRangeMetrics | null> {
  if (organizationIds.length === 0) return null;

  const { data, error } = await supabase.rpc("dashboard_call_range_metrics", {
    p_organization_ids: organizationIds,
    p_lower: lowerIso,
    p_upper: upperIso,
  });

  if (error) {
    console.error("[dashboard] call range metrics failed", error.message);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        total_calls: number | string | null;
        routed_count: number | string | null;
        avg_duration_seconds: number | string | null;
        total_duration_seconds: number | string | null;
      }
    | undefined;

  if (!row) {
    return { totalCalls: 0, routedCount: 0, avgDurationSeconds: 0, totalDurationSeconds: 0 };
  }

  return {
    totalCalls: Number(row.total_calls ?? 0),
    routedCount: Number(row.routed_count ?? 0),
    avgDurationSeconds: Number(row.avg_duration_seconds ?? 0),
    totalDurationSeconds: Number(row.total_duration_seconds ?? 0),
  };
}

export async function fetchDashboardCallOutcomeCounts(
  supabase: SupabaseClient,
  organizationIds: string[],
  lowerIso: string,
  upperIso: string | null,
): Promise<DashboardCallOutcomeCount[]> {
  if (organizationIds.length === 0) return [];

  const { data, error } = await supabase.rpc("dashboard_call_outcome_counts", {
    p_organization_ids: organizationIds,
    p_lower: lowerIso,
    p_upper: upperIso,
  });

  if (error) {
    console.error("[dashboard] call outcome counts failed", error.message);
    return [];
  }

  return (data ?? []).map((row: { outcome: string; call_count: number | string }) => ({
    outcome: String(row.outcome ?? ""),
    callCount: Number(row.call_count ?? 0),
  }));
}
