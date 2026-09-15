import {
  addDays,
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const DUBLIN = "Europe/Dublin";
const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatCallsPageDateParam(
  date: Date,
  now: Date = new Date(),
): string {
  const zoned = toZonedTime(date, DUBLIN);
  void now;
  return format(zoned, "yyyy-MM-dd");
}

export function parseCallsPageDateParam(
  raw: string | string[] | undefined,
  now: Date = new Date(),
): Date {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && DATE_PARAM_RE.test(v)) {
    const parsed = fromZonedTime(`${v}T00:00:00`, DUBLIN);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const zonedNow = toZonedTime(now, DUBLIN);
  return fromZonedTime(startOfDay(zonedNow), DUBLIN);
}

export function getCallsPageDayBoundsIso(date: Date): {
  lowerInclusive: string;
  upperExclusive: string;
} {
  const zoned = toZonedTime(date, DUBLIN);
  const start = startOfDay(zoned);
  const nextDay = addDays(start, 1);
  return {
    lowerInclusive: fromZonedTime(start, DUBLIN).toISOString(),
    upperExclusive: fromZonedTime(nextDay, DUBLIN).toISOString(),
  };
}

export function callsPageDateForTimestamp(
  iso: string,
  now: Date = new Date(),
): string {
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) {
    return formatCallsPageDateParam(now, now);
  }
  return formatCallsPageDateParam(ts, now);
}

export function isCallsPageToday(date: Date, now: Date = new Date()): boolean {
  return (
    formatCallsPageDateParam(date, now) === formatCallsPageDateParam(now, now)
  );
}

export function callsPageDateGreetingSubline(
  date: Date,
  now: Date = new Date(),
): string {
  return new Intl.DateTimeFormat("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: DUBLIN,
  }).format(date);
}

export function callsPageCalendarDays(month: Date): Date[] {
  const zonedMonth = toZonedTime(month, DUBLIN);
  const monthStart = startOfMonth(zonedMonth);
  const monthEnd = endOfMonth(zonedMonth);
  const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const gridEnd = addDays(monthEnd, (7 - ((monthEnd.getDay() + 6) % 7)) % 7);
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((day) =>
    fromZonedTime(day, DUBLIN),
  );
}
