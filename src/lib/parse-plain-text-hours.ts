import {
  DAY_KEYS,
  emptyWeekSchedule,
  type DayKey,
  type WeekSchedule,
  weekScheduleHasOpenDay,
} from "@/lib/business-hours";

export type ParsePlainTextHoursResult = {
  schedule: WeekSchedule;
  confidence: "parsed" | "fallback";
  hoursNote?: string;
};

const DAY_ALIASES: Record<string, DayKey> = {
  mon: "monday",
  monday: "monday",
  tue: "tuesday",
  tues: "tuesday",
  tuesday: "tuesday",
  wed: "wednesday",
  wednesday: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  thursday: "thursday",
  fri: "friday",
  friday: "friday",
  sat: "saturday",
  saturday: "saturday",
  sun: "sunday",
  sunday: "sunday",
};

const DAY_ORDER: DayKey[] = DAY_KEYS;

function normalizeDayToken(raw: string): DayKey | null {
  const key = raw.trim().toLowerCase().replace(/\./g, "");
  return DAY_ALIASES[key] ?? null;
}

function dayIndex(day: DayKey): number {
  return DAY_ORDER.indexOf(day);
}

function expandDayRange(start: DayKey, end: DayKey): DayKey[] {
  const a = dayIndex(start);
  const b = dayIndex(end);
  if (a < 0 || b < 0) return [];
  if (a <= b) return DAY_ORDER.slice(a, b + 1);
  return [...DAY_ORDER.slice(a), ...DAY_ORDER.slice(0, b + 1)];
}

function parseTimeTo24(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;

  const match = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (minute < 0 || minute > 59) return null;

  if (meridiem === "am") {
    if (hour === 12) hour = 0;
  } else if (meridiem === "pm") {
    if (hour < 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }

  if (hour < 0 || hour > 23) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeRange(raw: string): { start: string; end: string } | null {
  const parts = raw.split(/[–—-]/);
  if (parts.length < 2) return null;
  const start = parseTimeTo24(parts[0] ?? "");
  const end = parseTimeTo24(parts.slice(1).join("-") ?? "");
  if (!start || !end) return null;
  return { start, end };
}

function applyOpenDays(
  schedule: WeekSchedule,
  days: DayKey[],
  start: string,
  end: string,
): void {
  for (const day of days) {
    schedule[day] = { open: true, start, end };
  }
}

function applyClosedDays(schedule: WeekSchedule, days: DayKey[]): void {
  for (const day of days) {
    schedule[day] = { ...schedule[day], open: false };
  }
}

function parseDayList(segment: string): DayKey[] {
  const days: DayKey[] = [];
  const chunks = segment.split(/[,&]|\band\b/i);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const rangeMatch = trimmed.match(/^([A-Za-z]+)\s*[–—-]\s*([A-Za-z]+)$/);
    if (rangeMatch) {
      const start = normalizeDayToken(rangeMatch[1] ?? "");
      const end = normalizeDayToken(rangeMatch[2] ?? "");
      if (start && end) {
        days.push(...expandDayRange(start, end));
      }
      continue;
    }

    const day = normalizeDayToken(trimmed);
    if (day) days.push(day);
  }
  return [...new Set(days)];
}

const APPOINTMENT_DAY_HOURS = { start: "09:00", end: "17:00" };

function applyAppointmentOnlyDays(
  schedule: WeekSchedule,
  days: DayKey[],
): void {
  applyOpenDays(
    schedule,
    days,
    APPOINTMENT_DAY_HOURS.start,
    APPOINTMENT_DAY_HOURS.end,
  );
}

function truncateHoursNote(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

/**
 * Best-effort parse of plain-text opening hours into a week schedule.
 * Returns null when input is empty.
 */
export function parsePlainTextOpeningHours(
  raw: string,
): ParsePlainTextHoursResult | null {
  const text = raw.trim();
  if (!text) return null;

  const schedule = emptyWeekSchedule();
  let matchedSegment = false;

  const open24_7 = /\bopen\s*24\s*\/\s*7\b/i.test(text) || /\b24\s*hours?\b/i.test(text);
  if (open24_7) {
    for (const day of DAY_KEYS) {
      schedule[day] = { open: true, start: "00:00", end: "23:59" };
    }
    return { schedule, confidence: "parsed" };
  }

  const closedMatches = [
    ...text.matchAll(/\bclosed?\s+([A-Za-z][A-Za-z,&\s–—-]*)/gi),
  ];
  for (const match of closedMatches) {
    const days = parseDayList(match[1] ?? "");
    if (days.length > 0) {
      applyClosedDays(schedule, days);
      matchedSegment = true;
    }
  }

  const appointmentNotes: string[] = [];
  const supplementalNotes: string[] = [];

  const segments = text
    .split(/[.;]\s*/)
    .flatMap((part) => part.split(/,\s*(?=[A-Za-z])/))
    .map((part) => part.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const appointmentMatch = segment.match(
      /^([A-Za-z][A-Za-z,&\s–—-]*?)\s+by\s+appointment\b/i,
    );
    if (!appointmentMatch) continue;

    const days = parseDayList(appointmentMatch[1] ?? "");
    if (days.length === 0) continue;

    applyAppointmentOnlyDays(schedule, days);
    appointmentNotes.push(segment.trim());
    matchedSegment = true;
  }

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (/^closed?\b/i.test(trimmed)) {
      const remainder = trimmed.replace(/^closed?\s+(?:on\s+)?/i, "");
      const days = parseDayList(remainder);
      if (days.length === 0) {
        supplementalNotes.push(trimmed);
      }
      continue;
    }
    if (/\bby\s+appointment\b/i.test(segment)) continue;

    const rangeMatch = segment.match(
      /^([A-Za-z][A-Za-z,&\s–—-]*?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[–—-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    );
    if (!rangeMatch) continue;

    const days = parseDayList(rangeMatch[1] ?? "");
    const times = parseTimeRange(rangeMatch[2] ?? "");
    if (days.length === 0 || !times) continue;

    applyOpenDays(schedule, days, times.start, times.end);
    matchedSegment = true;
  }

  if (weekScheduleHasOpenDay(schedule)) {
    const noteParts = [...appointmentNotes, ...supplementalNotes];
    const hoursNote =
      noteParts.length > 0
        ? truncateHoursNote(noteParts.join("; "))
        : matchedSegment
          ? undefined
          : truncateHoursNote(text);
    return {
      schedule,
      confidence: matchedSegment ? "parsed" : "fallback",
      hoursNote,
    };
  }

  return {
    schedule,
    confidence: "fallback",
    hoursNote: truncateHoursNote(text),
  };
}

/** Fill hours note when structured storage lost qualifiers from plain-text onboarding. */
export function recoverHoursNoteFromSources(
  storedNote: string | undefined,
  legacyOpeningHours: string | undefined,
  businessRules: string[] = [],
): string {
  const stored = storedNote?.trim() ?? "";
  if (stored) return stored;

  const legacy = legacyOpeningHours?.trim() ?? "";
  if (legacy) {
    const parsed = parsePlainTextOpeningHours(legacy);
    if (parsed?.hoursNote?.trim()) return parsed.hoursNote.trim();
  }

  for (const rule of businessRules) {
    const trimmed = rule.trim();
    if (!/\b(?:bank|public)\s+holidays?\b/i.test(trimmed)) continue;
    const match = trimmed.match(
      /\bclosed\s+(?:on\s+)?(?:bank|public)\s+holidays?\.?/i,
    );
    if (match) return match[0].replace(/\.$/, "");
    return trimmed.slice(0, 120);
  }

  return "";
}
