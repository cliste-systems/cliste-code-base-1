/**
 * Home dashboard preview data — opt-in only.
 * Set DASHBOARD_HOME_MOCK=1 locally to preview demo charts.
 */
export function isDashboardHomeMockEnabled(): boolean {
  return process.env.DASHBOARD_HOME_MOCK === "1";
}
