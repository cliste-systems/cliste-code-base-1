/** Max rows fetched for Home recent activity (client trims to fit viewport). */
export const DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT = 32;

/** Max open inbox rows fetched for Home Needs attention (client trims to fit viewport). */
export const DASHBOARD_HOME_ATTENTION_ROW_LIMIT = 32;

/** @deprecated Use DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT */
export const DASHBOARD_HOME_PANEL_ROW_LIMIT = DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT;

/** Rows shown in Cara Status / Next steps (paired footer row). */
export const DASHBOARD_HOME_FOOTER_ROW_LIMIT = 3;

/** Fallback row height before first DOM measure (icon chip + single line). */
export const DASHBOARD_HOME_LIST_ROW_HEIGHT_PX = 40;

/** Dense home feed row (icon chip + single line). */
const ROW_HEIGHT_PX = DASHBOARD_HOME_LIST_ROW_HEIGHT_PX;

/** Attention rows include a subtitle line. */
export const DASHBOARD_HOME_ATTENTION_ROW_HEIGHT_PX = 56;
const ROW_GAP_PX = 0;

/** Fixed list area height for legacy layout helpers. */
export function dashboardHomeListBodyMinHeightPx(rowCount: number): number {
  if (rowCount <= 0) return 0;
  return rowCount * ROW_HEIGHT_PX + (rowCount - 1) * ROW_GAP_PX;
}

export const DASHBOARD_HOME_FEED_BODY_MIN_HEIGHT_PX = dashboardHomeListBodyMinHeightPx(
  DASHBOARD_HOME_PANEL_ROW_LIMIT,
);

export const DASHBOARD_HOME_FOOTER_BODY_MIN_HEIGHT_PX = dashboardHomeListBodyMinHeightPx(
  DASHBOARD_HOME_FOOTER_ROW_LIMIT,
);
