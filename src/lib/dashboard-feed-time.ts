import { addDays, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { formatE164ForDisplay } from "@/lib/call-history-types";

const DUBLIN = "Europe/Dublin";

/**
 * Home feed timestamps: time-only for today (Dublin), otherwise include the date
 * so an old open ticket does not look like it happened this morning.
 */
export function formatDashboardFeedTime(
  iso: string,
  now: Date = new Date(),
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const zonedNow = toZonedTime(now, DUBLIN);
  const zonedEvent = toZonedTime(d, DUBLIN);
  const startToday = startOfDay(zonedNow);
  const startEventDay = startOfDay(zonedEvent);

  const timeLabel = d
    .toLocaleTimeString("en-IE", {
      timeZone: DUBLIN,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (startEventDay.getTime() === startToday.getTime()) {
    return timeLabel;
  }

  const startYesterday = addDays(startToday, -1);
  if (startEventDay.getTime() === startYesterday.getTime()) {
    return `Yesterday, ${timeLabel}`;
  }

  const dateLabel = d.toLocaleDateString("en-IE", {
    timeZone: DUBLIN,
    day: "numeric",
    month: "short",
  });
  return `${dateLabel}, ${timeLabel}`;
}

export function ticketCallerLabel(input: {
  caller_name?: string | null;
  caller_number?: string | null;
}): string {
  const name = input.caller_name?.trim();
  if (name) return name;
  const phone = input.caller_number?.trim();
  if (phone) return formatE164ForDisplay(phone) || phone;
  return "Caller";
}
