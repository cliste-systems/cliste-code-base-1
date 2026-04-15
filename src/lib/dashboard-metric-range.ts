import { addDays, startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type DashboardMetricRangeKey = "today" | "yesterday" | "7d" | "4w";

const DUBLIN = "Europe/Dublin";

export function parseDashboardMetricRange(
  raw: string | string[] | undefined,
): DashboardMetricRangeKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "yesterday" || v === "7d" || v === "4w") return v;
  return "today";
}

/**
 * Lower bound (inclusive) for `created_at >=` filters in UTC ISO.
 */
export function getDashboardMetricRangeLowerBoundIso(
  key: DashboardMetricRangeKey,
  now: Date = new Date(),
): string {
  if (key === "7d") {
    return subDays(now, 7).toISOString();
  }
  if (key === "4w") {
    return subDays(now, 28).toISOString();
  }

  const zonedNow = toZonedTime(now, DUBLIN);
  const startTodayZoned = startOfDay(zonedNow);

  if (key === "today") {
    return fromZonedTime(startTodayZoned, DUBLIN).toISOString();
  }

  const startYesterdayZoned = subDays(startTodayZoned, 1);
  return fromZonedTime(startYesterdayZoned, DUBLIN).toISOString();
}

/**
 * Exclusive upper bound for "yesterday" (`lt`). Null when a simple `gte` from lower bound is enough.
 */
export function getDashboardMetricRangeUpperExclusiveIso(
  key: DashboardMetricRangeKey,
  now: Date = new Date(),
): string | null {
  if (key !== "yesterday") return null;
  const zonedNow = toZonedTime(now, DUBLIN);
  const startTodayZoned = startOfDay(zonedNow);
  return fromZonedTime(startTodayZoned, DUBLIN).toISOString();
}

/** Start of tomorrow in Dublin (UTC ISO), for `lt created_at` “end of calendar today”. */
export function getDublinCalendarDayEndExclusiveIso(
  now: Date = new Date(),
): string {
  const zonedNow = toZonedTime(now, DUBLIN);
  const startTodayZoned = startOfDay(zonedNow);
  const startTomorrowZoned = addDays(startTodayZoned, 1);
  return fromZonedTime(startTomorrowZoned, DUBLIN).toISOString();
}

export function dashboardMetricRangePeriodPhrase(
  key: DashboardMetricRangeKey,
): string {
  switch (key) {
    case "today":
      return "today";
    case "yesterday":
      return "yesterday";
    case "7d":
      return "last 7 days";
    case "4w":
      return "last 4 weeks";
    default:
      return "today";
  }
}
