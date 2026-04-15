/** HttpOnly cookies: last time user opened each dashboard area (nav badge baseline). */

export const DASHBOARD_CALL_HISTORY_SEEN_COOKIE =
  "dashboard_call_history_seen_at";

export const DASHBOARD_ACTION_INBOX_SEEN_COOKIE =
  "dashboard_action_inbox_seen_at";

export const DASHBOARD_CALENDAR_SEEN_COOKIE = "dashboard_calendar_seen_at";

export const DASHBOARD_BOOKINGS_SEEN_COOKIE = "dashboard_bookings_seen_at";

export function dashboardNavSeenCookieOptions() {
  return {
    path: "/dashboard",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

export function parseSeenAtCookie(raw: string | undefined): Date | null {
  if (raw == null || raw === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
