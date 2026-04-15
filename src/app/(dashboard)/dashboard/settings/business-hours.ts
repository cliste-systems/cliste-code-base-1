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

const DAYS: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function isDaySchedule(v: unknown): v is DaySchedule {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.open === "boolean" &&
    typeof o.start === "string" &&
    typeof o.end === "string"
  );
}

/** Merge stored JSONB with defaults so missing days still render. */
export function parseBusinessHoursFromDb(raw: unknown): WeekSchedule {
  const base = defaultWeekSchedule();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const o = raw as Record<string, unknown>;
  const out: WeekSchedule = { ...base };
  for (const day of DAYS) {
    const v = o[day];
    if (isDaySchedule(v)) {
      out[day] = { open: v.open, start: v.start, end: v.end };
    }
  }
  return out;
}
