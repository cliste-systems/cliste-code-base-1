import type { SupabaseClient } from "@supabase/supabase-js";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { getDashboardMetricRangeLowerBoundIso } from "@/lib/dashboard-metric-range";

export {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  DASHBOARD_CARA_TRAINING_SEEN_COOKIE,
} from "./dashboard-nav-seen-cookies";

export type DashboardNavBadgeMap = Partial<Record<string, number>>;

export type DashboardNavSeenAt = {
  callHistory: Date | null;
  actionInbox: Date | null;
  caraTraining: Date | null;
};

function countHead(
  res: { count: number | null; error: { message: string } | null },
): number {
  if (res.error) return 0;
  return res.count ?? 0;
}

const EMPTY_SEEN_AT: DashboardNavSeenAt = {
  callHistory: null,
  actionInbox: null,
  caraTraining: null,
};

/**
 * Sidebar badges show live totals (open inbox, training gaps, calls today).
 * Visiting a page does not clear the count.
 */
export async function fetchDashboardNavBadges(
  supabase: SupabaseClient,
  organizationId: string,
  _seen: DashboardNavSeenAt | null | undefined,
): Promise<DashboardNavBadgeMap> {
  const callsTodaySince = getDashboardMetricRangeLowerBoundIso("today");

  const [openRes, callHistoryRes, trainingRes] = await Promise.all([
    supabase
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open"),
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", callsTodaySince),
    supabase
      .from("cara_training_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["awaiting_answer", "draft_ready"]),
  ]);

  const callBadge = countHead(callHistoryRes);
  const inboxBadge = countHead(openRes);
  const trainingBadge = countHead(trainingRes);
  return {
    "/dashboard/action-inbox": inboxBadge,
    "/dashboard/calls": callBadge,
    "/dashboard/call-history": callBadge,
    [DASHBOARD_ROUTES.caraTraining]: trainingBadge,
  };
}

export function formatNavBadgeCount(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}
