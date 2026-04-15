import type { SupabaseClient } from "@supabase/supabase-js";

export {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_BOOKINGS_SEEN_COOKIE,
  DASHBOARD_CALENDAR_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
} from "./dashboard-nav-seen-cookies";

export type DashboardNavBadgeMap = Partial<Record<string, number>>;

/** When no “seen” cookie yet, treat activity since this rolling window as the badge. */
const SEEN_FALLBACK_MS = 24 * 60 * 60 * 1000;

export type DashboardNavSeenAt = {
  callHistory: Date | null;
  actionInbox: Date | null;
  calendar: Date | null;
  bookings: Date | null;
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

/**
 * Sidebar counts use “new since last visit” per route (httpOnly cookies), with a
 * 24h fallback if the user has never opened that area. Native: calendar & bookings.
 */
const EMPTY_SEEN_AT: DashboardNavSeenAt = {
  callHistory: null,
  actionInbox: null,
  calendar: null,
  bookings: null,
};

export async function fetchDashboardNavBadges(
  supabase: SupabaseClient,
  organizationId: string,
  includeNativeAppointmentBadges: boolean,
  seen: DashboardNavSeenAt | null | undefined,
): Promise<DashboardNavBadgeMap> {
  const s = seen ?? EMPTY_SEEN_AT;
  const actionInboxSince = sinceOrFallback(s.actionInbox);
  const openRes = await supabase
    .from("action_tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .gt("created_at", actionInboxSince);

  const callHistorySince = sinceOrFallback(s.callHistory);
  const callHistoryRes = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gt("created_at", callHistorySince);

  const badges: DashboardNavBadgeMap = {
    "/dashboard/action-inbox": countHead(openRes),
    "/dashboard/call-history": countHead(callHistoryRes),
  };

  if (!includeNativeAppointmentBadges) {
    return badges;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const startOfUtcDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const endOfUtcDay = new Date(startOfUtcDay);
  endOfUtcDay.setUTCDate(endOfUtcDay.getUTCDate() + 1);

  const calendarSince = sinceOrFallback(s.calendar);
  const bookingsSince = sinceOrFallback(s.bookings);

  const [weekRes, todayRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "confirmed")
      .gte("start_time", nowIso)
      .lt("start_time", weekEnd.toISOString())
      .gt("created_at", calendarSince),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "confirmed")
      .gte("start_time", startOfUtcDay.toISOString())
      .lt("start_time", endOfUtcDay.toISOString())
      .gt("created_at", bookingsSince),
  ]);

  badges["/dashboard/calendar"] = countHead(weekRes);
  badges["/dashboard/bookings"] = countHead(todayRes);

  return badges;
}

export function formatNavBadgeCount(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}
