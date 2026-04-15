/** Set when admin uses "Open dashboard"; sidebar shows "dev" instead of the salon user's name. */
export const SUPPORT_DASHBOARD_COOKIE = "cliste_support_dashboard";

export function supportDashboardCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
