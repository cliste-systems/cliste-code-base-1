import {
  getDashboardMetricRangeLowerBoundIso,
  type DashboardMetricRangeKey,
} from "@/lib/dashboard-metric-range";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

/** Smallest dashboard range that includes the given call timestamp. */
export function dashboardMetricRangeForTimestamp(
  iso: string,
  now: Date = new Date(),
): DashboardMetricRangeKey {
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return "7d";

  const todayLower = new Date(getDashboardMetricRangeLowerBoundIso("today", now));
  if (ts >= todayLower) return "today";

  const sevenLower = new Date(getDashboardMetricRangeLowerBoundIso("7d", now));
  if (ts >= sevenLower) return "7d";

  return "4w";
}

export function buildCallsPageHref(
  input: {
    callLogId?: string | null;
    callCreatedAt?: string | null;
    page?: number;
  },
  now: Date = new Date(),
): string {
  const callId = String(input.callLogId ?? "").trim();
  if (!callId) return DASHBOARD_ROUTES.calls;

  const params = new URLSearchParams();
  params.set("call", callId);

  const createdAt = String(input.callCreatedAt ?? "").trim();
  const range = createdAt
    ? dashboardMetricRangeForTimestamp(createdAt, now)
    : ("7d" as DashboardMetricRangeKey);

  if (range !== "today") {
    params.set("range", range);
  }

  if (input.page != null && input.page > 1) {
    params.set("page", String(input.page));
  }

  return `${DASHBOARD_ROUTES.calls}?${params.toString()}`;
}
