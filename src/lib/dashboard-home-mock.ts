const KAVANAGHS_DEMO_ORG_SLUG = "kavanaghs-supervalu-donegal-town";

/**
 * Overview (/dashboard) preview charts — not used on calls, inbox, etc.
 * Kavanaghs demo org uses mock overview by default; set DASHBOARD_HOME_MOCK=0 to disable.
 */
export function isDashboardHomeMockEnabled(orgSlug?: string | null): boolean {
  if (process.env.DASHBOARD_HOME_MOCK === "0") return false;
  if (process.env.DASHBOARD_HOME_MOCK === "1") return true;
  return orgSlug === KAVANAGHS_DEMO_ORG_SLUG;
}
