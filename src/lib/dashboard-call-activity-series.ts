import { addDays, addHours, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";

const DUBLIN = "Europe/Dublin";

export type CallActivityPoint = {
  key: string;
  label: string;
  callsAnswered: number;
};

/**
 * Bucket call timestamps for the home Call activity chart.
 * Today → hourly (Dublin); 7d / 30d (4w) → daily (Dublin).
 */
export function buildCallActivitySeries(
  range: DashboardMetricRangeKey,
  callTimestampsIso: string[],
  now: Date = new Date(),
): CallActivityPoint[] {
  const zonedNow = toZonedTime(now, DUBLIN);
  const dayStartZoned = startOfDay(zonedNow);
  const dayStartUtc = fromZonedTime(dayStartZoned, DUBLIN);

  if (range === "today") {
    const buckets: CallActivityPoint[] = [];
    for (let h = 0; h < 24; h++) {
      const instant = addHours(dayStartUtc, h);
      buckets.push({
        key: formatInTimeZone(instant, DUBLIN, "yyyy-MM-dd-HH"),
        label: formatInTimeZone(instant, DUBLIN, "ha").replace(/\s/g, "").toLowerCase(),
        callsAnswered: 0,
      });
    }

    const todayKey = formatInTimeZone(now, DUBLIN, "yyyy-MM-dd");
    for (const iso of callTimestampsIso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      if (formatInTimeZone(d, DUBLIN, "yyyy-MM-dd") !== todayKey) continue;
      const hourKey = formatInTimeZone(d, DUBLIN, "yyyy-MM-dd-HH");
      const bucket = buckets.find((b) => b.key === hourKey);
      if (bucket) bucket.callsAnswered += 1;
    }

    return buckets;
  }

  const dayCount = range === "7d" ? 7 : 28;
  const buckets: CallActivityPoint[] = [];

  for (let i = dayCount - 1; i >= 0; i--) {
    const dayZoned = addDays(dayStartZoned, -i);
    const instant = fromZonedTime(dayZoned, DUBLIN);
    buckets.push({
      key: formatInTimeZone(instant, DUBLIN, "yyyy-MM-dd"),
      label:
        range === "7d"
          ? formatInTimeZone(instant, DUBLIN, "EEE")
          : formatInTimeZone(instant, DUBLIN, "d MMM"),
      callsAnswered: 0,
    });
  }

  const allowedKeys = new Set(buckets.map((b) => b.key));
  for (const iso of callTimestampsIso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const key = formatInTimeZone(d, DUBLIN, "yyyy-MM-dd");
    if (!allowedKeys.has(key)) continue;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.callsAnswered += 1;
  }

  return buckets;
}

export function formatCallActivityTotal(count: number): string {
  return `${count} call${count === 1 ? "" : "s"}`;
}

/**
 * For sparse periods, chart only buckets that have calls so bars are readable.
 * Counts stay real — empty days are omitted from the plot only.
 */
export function selectCallVolumeChartPoints(
  range: DashboardMetricRangeKey,
  points: CallActivityPoint[],
): CallActivityPoint[] {
  const active = points.filter((p) => p.callsAnswered > 0);
  if (active.length === 0) return points;

  if (range === "today") {
    return active.length >= 18 ? points : active;
  }

  if (points.length <= 10) return points;
  if (active.length <= 14) return active;
  return points;
}
