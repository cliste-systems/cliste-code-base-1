import "server-only";

/**
 * Local-only dashboard without signing in — uses a real org from the dev database.
 *
 * Enable: `CLISTE_LOCAL_DASHBOARD_UNLOCK=1` in `.env.local`
 * Optional: `CLISTE_LOCAL_DASHBOARD_ORG_ID`, `CLISTE_LOCAL_DASHBOARD_PROFILE_ID`
 *
 * **Never set in production.** Ignored when `NODE_ENV=production`.
 */
export function isLocalDashboardPreviewEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_LOCAL_DASHBOARD_UNLOCK === "1";
}
