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

/**
 * Per-stylist windows for a single calendar day, in salon-local minutes
 * since midnight. Multiple ranges on the same weekday model lunch breaks
 * (e.g. 600-780 + 840-1080 = 10:00-13:00 + 14:00-18:00 with a 1 PM lunch).
 */
export type StaffDayWindow = { startMin: number; endMin: number };

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
 *
 * Optional inputs:
 *  - `staffWindows`: when present, the slot must also fall fully inside one of
 *    these per-stylist working windows. Empty array => stylist not working.
 *  - `staffBusy`: optional second busy list for the chosen stylist. Lets the
 *    public flow check "is THIS stylist free?" while still respecting the
 *    org-wide busy list.
 */
export function computeAvailableBookingSlots(input: {
  dateYmd: string;
  durationMinutes: number;
  weekSchedule: WeekSchedule;
  busy: BusyInterval[];
  now: Date;
  timeZone: string;
  slotStepMinutes?: number;
  staffWindows?: StaffDayWindow[];
  staffBusy?: BusyInterval[];
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  minNoticeMinutes?: number;
}): DashboardBookingSlot[] {
  const tz = input.timeZone;
  const step = input.slotStepMinutes ?? 15;
  const dayKey = dayKeyForCalendarDate(input.dateYmd, tz);
  const day = input.weekSchedule[dayKey];
  if (!day.open) return [];

  const openM = parseHHMMToMinutes(day.start);
  const closeM = parseHHMMToMinutes(day.end);
  if (openM === null || closeM === null || closeM <= openM) return [];

  const before = Math.max(0, input.bufferBeforeMin ?? 0);
  const after = Math.max(0, input.bufferAfterMin ?? 0);
  const noticeMs = Math.max(0, input.minNoticeMinutes ?? 0) * 60_000;

  const lastStartMin = closeM - input.durationMinutes - after;
  const earliestStartMin = openM + before;
  if (lastStartMin < earliestStartMin) return [];

  if (input.staffWindows && input.staffWindows.length === 0) return [];

  const out: DashboardBookingSlot[] = [];

  for (let t = earliestStartMin; t <= lastStartMin; t += step) {
    const slotEndMin = t + input.durationMinutes;
    const effStart = t - before;
    const effEnd = slotEndMin + after;

    if (input.staffWindows && input.staffWindows.length > 0) {
      const insideStaffWindow = input.staffWindows.some(
        (w) => effStart >= w.startMin && effEnd <= w.endMin,
      );
      if (!insideStaffWindow) continue;
    }

    const h = Math.floor(t / 60);
    const m = t % 60;
    const startUtc = fromZonedTime(
      `${input.dateYmd} ${pad2(h)}:${pad2(m)}:00`,
      tz,
    );
    const minStart = input.now.getTime() + Math.max(FUTURE_BUFFER_MS, noticeMs);
    if (startUtc.getTime() < minStart) {
      continue;
    }

    const endUtc = addMinutes(startUtc, input.durationMinutes);
    const effStartUtc = addMinutes(startUtc, -before);
    const effEndUtc = addMinutes(endUtc, after);

    let blocked = false;
    for (const b of input.busy) {
      if (effStartUtc < b.end && effEndUtc > b.start) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    if (input.staffBusy && input.staffBusy.length > 0) {
      for (const b of input.staffBusy) {
        if (effStartUtc < b.end && effEndUtc > b.start) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
    }

    out.push({
      startIso: startUtc.toISOString(),
      label: formatInTimeZone(startUtc, tz, "EEE d MMM, h:mm a"),
    });
  }

  return out;
}

/**
 * Convert per-stylist `staff_working_hours` rows + `staff_time_off` rows
 * into a list of bookable windows for a single calendar day in `tz`,
 * expressed as minutes since salon-local midnight. Used by both the
 * dashboard and public booking flows.
 *
 * `weekday` is JS-style: 0 = Sunday … 6 = Saturday.
 */
export function staffDayWindowsForDate(input: {
  dateYmd: string;
  timeZone: string;
  weekday: number;
  workingHours: { weekday: number; opensAt: string; closesAt: string }[];
  timeOff: { startsAt: string; endsAt: string }[];
}): StaffDayWindow[] {
  const tz = input.timeZone;
  const baseRanges: StaffDayWindow[] = input.workingHours
    .filter((w) => w.weekday === input.weekday)
    .map((w) => {
      const s = parseHHMMToMinutes(w.opensAt.slice(0, 5));
      const e = parseHHMMToMinutes(w.closesAt.slice(0, 5));
      if (s === null || e === null || e <= s) return null;
      return { startMin: s, endMin: e };
    })
    .filter((x): x is StaffDayWindow => x !== null)
    .sort((a, b) => a.startMin - b.startMin);

  if (baseRanges.length === 0) return [];

  const dayStartUtc = fromZonedTime(`${input.dateYmd} 00:00:00`, tz);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  // Convert each time-off row into a (startMin, endMin) range overlapping
  // this calendar day in salon-local minutes.
  const offRanges: StaffDayWindow[] = [];
  for (const off of input.timeOff) {
    const offStart = new Date(off.startsAt);
    const offEnd = new Date(off.endsAt);
    if (Number.isNaN(offStart.getTime()) || Number.isNaN(offEnd.getTime())) {
      continue;
    }
    if (offEnd <= dayStartUtc || offStart >= dayEndUtc) continue;
    const clampedStart = offStart < dayStartUtc ? dayStartUtc : offStart;
    const clampedEnd = offEnd > dayEndUtc ? dayEndUtc : offEnd;
    const startMin = Math.max(
      0,
      Math.round((clampedStart.getTime() - dayStartUtc.getTime()) / 60_000),
    );
    const endMin = Math.min(
      24 * 60,
      Math.round((clampedEnd.getTime() - dayStartUtc.getTime()) / 60_000),
    );
    if (endMin > startMin) offRanges.push({ startMin, endMin });
  }
  offRanges.sort((a, b) => a.startMin - b.startMin);

  // Subtract each offRange from the union of baseRanges.
  let result: StaffDayWindow[] = [...baseRanges];
  for (const off of offRanges) {
    const next: StaffDayWindow[] = [];
    for (const r of result) {
      if (off.endMin <= r.startMin || off.startMin >= r.endMin) {
        next.push(r);
        continue;
      }
      if (off.startMin > r.startMin) {
        next.push({ startMin: r.startMin, endMin: off.startMin });
      }
      if (off.endMin < r.endMin) {
        next.push({ startMin: off.endMin, endMin: r.endMin });
      }
    }
    result = next;
  }
  return result;
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
