/** Fired when activity tables change — home listens for a lightweight client refetch. */
export const DASHBOARD_ACTIVITY_EVENT = "cliste:dashboard-activity";

export function dispatchDashboardActivityEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_ACTIVITY_EVENT));
}
