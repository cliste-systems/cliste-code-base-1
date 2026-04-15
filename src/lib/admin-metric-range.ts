import {
  addDays,
  addMonths,
  addWeeks,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const DUBLIN = "Europe/Dublin";

export type AdminGlobalMetricPeriod = "day" | "week" | "month";

export function parseAdminGlobalMetricPeriod(
  raw: string | string[] | undefined,
): AdminGlobalMetricPeriod {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "week" || v === "month") return v;
  return "day";
}

/**
 * Inclusive start and exclusive end (UTC ISO) for platform metrics in Europe/Dublin:
 * - day: calendar today
 * - week: Monday–Sunday week containing "now"
 * - month: calendar month
 */
export function getAdminGlobalMetricRange(
  period: AdminGlobalMetricPeriod,
  now: Date = new Date(),
): { startIso: string; endExclusiveIso: string } {
  const zonedNow = toZonedTime(now, DUBLIN);

  if (period === "day") {
    const startDay = startOfDay(zonedNow);
    const endDay = addDays(startDay, 1);
    return {
      startIso: fromZonedTime(startDay, DUBLIN).toISOString(),
      endExclusiveIso: fromZonedTime(endDay, DUBLIN).toISOString(),
    };
  }

  if (period === "week") {
    const startWeek = startOfWeek(zonedNow, { weekStartsOn: 1 });
    const endWeek = addWeeks(startWeek, 1);
    return {
      startIso: fromZonedTime(startWeek, DUBLIN).toISOString(),
      endExclusiveIso: fromZonedTime(endWeek, DUBLIN).toISOString(),
    };
  }

  const startMonth = startOfMonth(zonedNow);
  const endMonth = addMonths(startMonth, 1);
  return {
    startIso: fromZonedTime(startMonth, DUBLIN).toISOString(),
    endExclusiveIso: fromZonedTime(endMonth, DUBLIN).toISOString(),
  };
}

export function adminGlobalMetricPeriodShortLabel(
  period: AdminGlobalMetricPeriod,
): string {
  switch (period) {
    case "day":
      return "Day";
    case "week":
      return "Week";
    case "month":
      return "Month";
    default:
      return "Day";
  }
}
