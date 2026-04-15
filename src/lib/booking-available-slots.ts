import { addDays, addMinutes, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import type {
  DayKey,
  WeekSchedule,
} from "@/app/(dashboard)/dashboard/settings/business-hours";

import { getReminderTimezone } from "@/lib/appointment-reminder-sms";

export type BusyInterval = { start: Date; end: Date };

export type DashboardBookingSlot = {
  startIso: string;
  label: string;
};

const DAY_ORDER: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Inclusive UTC start and exclusive UTC end for the salon calendar day in `tz`. */
export function getCalendarDayUtcRange(
  dateYmd: string,
  tz: string,
): { startUtc: Date; endExclusiveUtc: Date } {
  const dayStartWall = fromZonedTime(`${dateYmd} 00:00:00`, tz);
  const z = toZonedTime(dayStartWall, tz);
  const nextMidnightLocal = addDays(startOfDay(z), 1);
  const endExclusiveUtc = fromZonedTime(nextMidnightLocal, tz);
  return { startUtc: dayStartWall, endExclusiveUtc };
}

function dayKeyForCalendarDate(dateYmd: string, tz: string): DayKey {
  const d = fromZonedTime(`${dateYmd} 12:00:00`, tz);
  const z = toZonedTime(d, tz);
  return DAY_ORDER[z.getDay()]!;
}

function parseHHMMToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const FUTURE_BUFFER_MS = 60_000;

/**
 * Available start times for a service on a calendar day: within business hours,
 * honouring duration (appointment ends by closing), existing confirmed bookings,
 * and step (default 15 min).
 */
export function computeAvailableBookingSlots(input: {
  dateYmd: string;
  durationMinutes: number;
  weekSchedule: WeekSchedule;
  busy: BusyInterval[];
  now: Date;
  timeZone: string;
  slotStepMinutes?: number;
}): DashboardBookingSlot[] {
  const tz = input.timeZone;
  const step = input.slotStepMinutes ?? 15;
  const dayKey = dayKeyForCalendarDate(input.dateYmd, tz);
  const day = input.weekSchedule[dayKey];
  if (!day.open) return [];

  const openM = parseHHMMToMinutes(day.start);
  const closeM = parseHHMMToMinutes(day.end);
  if (openM === null || closeM === null || closeM <= openM) return [];

  const lastStartMin = closeM - input.durationMinutes;
  if (lastStartMin < openM) return [];

  const out: DashboardBookingSlot[] = [];

  for (let t = openM; t <= lastStartMin; t += step) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const startUtc = fromZonedTime(
      `${input.dateYmd} ${pad2(h)}:${pad2(m)}:00`,
      tz,
    );
    if (startUtc.getTime() < input.now.getTime() + FUTURE_BUFFER_MS) {
      continue;
    }

    const endUtc = addMinutes(startUtc, input.durationMinutes);

    let blocked = false;
    for (const b of input.busy) {
      if (startUtc < b.end && endUtc > b.start) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    out.push({
      startIso: startUtc.toISOString(),
      label: formatInTimeZone(startUtc, tz, "EEE d MMM, h:mm a"),
    });
  }

  return out;
}

export function getSalonTimeZone(): string {
  return getReminderTimezone();
}

/** Calendar `yyyy-MM-dd` in `tz` for "now" (wall clock). */
export function todayYmdInTimeZone(tz: string): string {
  return formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
}

/** Add signed calendar days to a `yyyy-MM-dd` in timezone `tz` (noon anchor avoids DST edge cases). */
export function addDaysToYmd(
  ymd: string,
  deltaDays: number,
  tz: string,
): string {
  const anchor = fromZonedTime(`${ymd}T12:00:00`, tz);
  const d = addDays(anchor, deltaDays);
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

/** True if `start` matches one of the precomputed slot instants (±500ms). */
export function isStartInSlotList(
  start: Date,
  slots: Pick<DashboardBookingSlot, "startIso">[],
): boolean {
  const t = start.getTime();
  return slots.some((s) => Math.abs(new Date(s.startIso).getTime() - t) < 500);
}
