export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DaySchedule = {
  open: boolean;
  start: string;
  end: string;
};

export type WeekSchedule = Record<DayKey, DaySchedule>;

export type WeekScheduleMeta = {
  open24_7?: boolean;
  hoursNote?: string;
};

const META_OPEN_24_7 = "_open24_7";
const META_HOURS_NOTE = "_hoursNote";

export const DAY_KEYS: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const DAY_LABELS_SHORT: Record<DayKey, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export function defaultWeekSchedule(): WeekSchedule {
  return {
    monday: { open: true, start: "09:00", end: "17:30" },
    tuesday: { open: true, start: "09:00", end: "17:30" },
    wednesday: { open: true, start: "09:00", end: "17:30" },
    thursday: { open: true, start: "09:00", end: "17:30" },
    friday: { open: true, start: "09:00", end: "18:00" },
    saturday: { open: true, start: "10:00", end: "16:00" },
    sunday: { open: false, start: "10:00", end: "14:00" },
  };
}

/** Fresh onboarding — nothing open until the owner ticks days. */
export function emptyWeekSchedule(): WeekSchedule {
  const base = defaultWeekSchedule();
  return Object.fromEntries(
    DAY_KEYS.map((day) => [day, { ...base[day], open: false }]),
  ) as WeekSchedule;
}

function isDaySchedule(v: unknown): v is DaySchedule {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.open === "boolean" &&
    typeof o.start === "string" &&
    typeof o.end === "string"
  );
}

/** True when the org has never saved structured hours (empty jsonb). */
export function isBusinessHoursUnset(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return true;
  return Object.keys(raw as Record<string, unknown>).length === 0;
}

function readWeekScheduleMeta(raw: Record<string, unknown>): WeekScheduleMeta {
  return {
    open24_7: raw[META_OPEN_24_7] === true,
    hoursNote:
      typeof raw[META_HOURS_NOTE] === "string"
        ? raw[META_HOURS_NOTE].trim().slice(0, 120)
        : "",
  };
}

export function parseBusinessHoursBundle(raw: unknown): {
  schedule: WeekSchedule;
  meta: WeekScheduleMeta;
} {
  const base = defaultWeekSchedule();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { schedule: base, meta: {} };
  }
  const o = raw as Record<string, unknown>;
  const meta = readWeekScheduleMeta(o);
  const out: WeekSchedule = { ...base };
  for (const day of DAY_KEYS) {
    const v = o[day];
    if (isDaySchedule(v)) {
      out[day] = { open: v.open, start: v.start, end: v.end };
    }
  }
  return { schedule: out, meta };
}

export function serializeBusinessHours(
  schedule: WeekSchedule,
  meta: WeekScheduleMeta = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...schedule };
  if (meta.open24_7) payload[META_OPEN_24_7] = true;
  if (meta.hoursNote?.trim()) {
    payload[META_HOURS_NOTE] = meta.hoursNote.trim().slice(0, 120);
  }
  return payload;
}

export function open24_7WeekSchedule(): WeekSchedule {
  return Object.fromEntries(
    DAY_KEYS.map((day) => [
      day,
      { open: true, start: "00:00", end: "23:59" },
    ]),
  ) as WeekSchedule;
}

export function weekScheduleHasOpenDay(schedule: WeekSchedule): boolean {
  return DAY_KEYS.some((day) => schedule[day].open);
}
