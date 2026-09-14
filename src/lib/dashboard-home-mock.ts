/**
 * Overview (/dashboard) preview charts — not used on calls, inbox, departments, etc.
 * Live data by default; set DASHBOARD_HOME_MOCK=1 to enable mock hero/charts for demos.
 */
export function isDashboardHomeMockEnabled(orgSlug?: string | null): boolean {
  if (process.env.DASHBOARD_HOME_MOCK === "0") return false;
  if (process.env.DASHBOARD_HOME_MOCK === "1") return true;
  void orgSlug;
  return false;
}
