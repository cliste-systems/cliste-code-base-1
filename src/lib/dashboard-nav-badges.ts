import type { SupabaseClient } from "@supabase/supabase-js";

export {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  DASHBOARD_CARA_TRAINING_SEEN_COOKIE,
} from "./dashboard-nav-seen-cookies";

export type DashboardNavBadgeMap = Partial<Record<string, number>>;

/** When no “seen” cookie yet, treat activity since this rolling window as the badge. */
const SEEN_FALLBACK_MS = 24 * 60 * 60 * 1000;

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

function sinceOrFallback(seen: Date | null): string {
  if (seen != null && !Number.isNaN(seen.getTime())) {
    return seen.toISOString();
  }
  return new Date(Date.now() - SEEN_FALLBACK_MS).toISOString();
}

const EMPTY_SEEN_AT: DashboardNavSeenAt = {
  callHistory: null,
  actionInbox: null,
  caraTraining: null,
};

/**
 * Sidebar counts use “new since last visit” per route (httpOnly cookies), with a
 * 24h fallback if the user has never opened that area.
 */
export async function fetchDashboardNavBadges(
  supabase: SupabaseClient,
  organizationId: string,
  seen: DashboardNavSeenAt | null | undefined,
): Promise<DashboardNavBadgeMap> {
  const s = seen ?? EMPTY_SEEN_AT;
  const actionInboxSince = sinceOrFallback(s.actionInbox);
  const callHistorySince = sinceOrFallback(s.callHistory);
  const caraTrainingSince = sinceOrFallback(s.caraTraining);

  const [openRes, callHistoryRes, trainingRes] = await Promise.all([
    supabase
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .gt("created_at", actionInboxSince),
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gt("created_at", callHistorySince),
    supabase
      .from("cara_training_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["awaiting_answer", "draft_ready"])
      .gt("updated_at", caraTrainingSince),
  ]);

  const callBadge = countHead(callHistoryRes);
  const inboxBadge = countHead(openRes);
  const trainingBadge = countHead(trainingRes);
  return {
    "/dashboard/action-inbox": inboxBadge,
    "/dashboard/calls": callBadge,
    "/dashboard/call-history": callBadge,
    "/dashboard/cara-training": trainingBadge,
  };
}

export function formatNavBadgeCount(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}
