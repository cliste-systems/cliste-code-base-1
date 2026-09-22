/** Rows shown in each overview column (Recent activity, Needs action, Needs input). */
export const DASHBOARD_HOME_SIDE_PANEL_DISPLAY_LIMIT = 5;

export const DASHBOARD_HOME_LIVE_ACTIVITY_DISPLAY_LIMIT =
  DASHBOARD_HOME_SIDE_PANEL_DISPLAY_LIMIT;

/** Rows shown in Action Inbox on the hybrid home board. */
export const DASHBOARD_HOME_INBOX_DISPLAY_LIMIT =
  DASHBOARD_HOME_SIDE_PANEL_DISPLAY_LIMIT;

/** Rows shown in Cara training on the hybrid home board. */
export const DASHBOARD_HOME_CARA_TRAINING_DISPLAY_LIMIT =
  DASHBOARD_HOME_SIDE_PANEL_DISPLAY_LIMIT;

/** Rows shown in the second home analytics row. */
export const DASHBOARD_HOME_SECOND_ROW_DISPLAY_LIMIT = 3;

/** @deprecated Use DASHBOARD_HOME_INBOX_DISPLAY_LIMIT */
export const DASHBOARD_HOME_FIRST_ROW_DISPLAY_LIMIT =
  DASHBOARD_HOME_INBOX_DISPLAY_LIMIT;

/** Fixed overview row height — shared across all three home columns. */
export const DASHBOARD_HOME_OVERVIEW_ROW_HEIGHT_CLASS = "h-[3.25rem] shrink-0";

/** Top chrome bar (breadcrumbs + versions) — reserve in home viewport budget. */
export const DASHBOARD_CHROME_BAR_HEIGHT_PX = 48;

/** Minimum card row height: padding + header + 3 list rows + footer CTA. */
export const DASHBOARD_HOME_FIRST_ROW_HEIGHT_PX = 242;

/** Four-column analytics row (What callers wanted, Call outcomes, Cara, Usage). */
export const DASHBOARD_HOME_ANALYTICS_ROW_HEIGHT_PX = 200;

/** Full-width Meet Cara footer card below the analytics row. */
export const DASHBOARD_HOME_FOOTER_BANNER_HEIGHT_PX = 150;

/** Max rows fetched for Home recent activity (client trims to fit viewport). */
export const DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT = 32;

/** Max open inbox rows fetched for Home Action Inbox (client trims to fit viewport). */
export const DASHBOARD_HOME_ATTENTION_ROW_LIMIT = 32;

/** Max Cara training rows fetched for Home (client trims to fit viewport). */
export const DASHBOARD_HOME_CARA_TRAINING_ROW_LIMIT = 32;

/** Rows shown in Cara Status / Next steps (paired footer row). */
export const DASHBOARD_HOME_FOOTER_ROW_LIMIT = 3;

/** Fallback row height before first DOM measure (icon chip + single line). */
export const DASHBOARD_HOME_LIST_ROW_HEIGHT_PX = 40;

/** Attention rows include a subtitle line. */
export const DASHBOARD_HOME_ATTENTION_ROW_HEIGHT_PX = 56;

const ROW_HEIGHT_PX = DASHBOARD_HOME_LIST_ROW_HEIGHT_PX;
const ROW_GAP_PX = 0;

/** Fixed list area height for legacy layout helpers. */
export function dashboardHomeListBodyMinHeightPx(rowCount: number): number {
  if (rowCount <= 0) return 0;
  return rowCount * ROW_HEIGHT_PX + (rowCount - 1) * ROW_GAP_PX;
}
