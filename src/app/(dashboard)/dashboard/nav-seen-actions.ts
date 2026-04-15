"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_BOOKINGS_SEEN_COOKIE,
  DASHBOARD_CALENDAR_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  dashboardNavSeenCookieOptions,
} from "@/lib/dashboard-nav-seen-cookies";
import { createClient } from "@/utils/supabase/server";

export type DashboardNavSeenKey =
  | "call-history"
  | "action-inbox"
  | "calendar"
  | "bookings";

const COOKIE_NAME: Record<DashboardNavSeenKey, string> = {
  "call-history": DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  "action-inbox": DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  calendar: DASHBOARD_CALENDAR_SEEN_COOKIE,
  bookings: DASHBOARD_BOOKINGS_SEEN_COOKIE,
};

/**
 * Persists “last opened” for nav badges. Uses a Server Action so `cookies()` is
 * updated in the same request the layout can read — unlike middleware-only Set-Cookie.
 */
export async function markDashboardNavSeen(key: DashboardNavSeenKey) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const store = await cookies();
  store.set(
    COOKIE_NAME[key],
    new Date().toISOString(),
    dashboardNavSeenCookieOptions(),
  );
  revalidatePath("/dashboard", "layout");
}
