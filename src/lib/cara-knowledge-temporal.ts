import {
  addDays,
  addHours,
  format,
  isBefore,
  isEqual,
  startOfDay,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import {
  DAY_KEYS,
  type DayKey,
  type WeekSchedule,
  parseBusinessHoursBundle,
} from "@/lib/business-hours";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";

export type TemporalDurationMode = "standard" | "limited" | "ongoing";

export type TemporalLifecycle =
  | "scheduled"
  | "active"
  | "expired"
  | "ended"
  | "cancelled";

export type TemporalSubjectType =
  | "opening_hours"
  | "faq"
  | "business_rule"
  | "notice"
  | "availability"
  | "price";

export type TemporalStartChoice = "now" | "scheduled";
export type TemporalEndChoice =
  | "end_of_today"
  | "24h_after_start"
  | "scheduled";

export type TemporalReviewReminderChoice = "none" | "1d" | "3d" | "1w";

export type TemporalOverridePreview = {
  normalLabel: string;
  normalBody: string | null;
  temporaryLabel: string;
  temporaryBody: string;
  scopeLabel: string;
  afterExpiryNote: string | null;
};

export type TemporalDraftInput = {
  durationMode: "limited" | "ongoing";
  startChoice: TemporalStartChoice;
  startAt?: string | null;
  endChoice?: TemporalEndChoice | null;
  endAt?: string | null;
  reviewReminderChoice?: TemporalReviewReminderChoice;
  subjectType: TemporalSubjectType;
  subjectRef?: string | null;
  subjectScope?: Record<string, unknown>;
  overridePreview?: TemporalOverridePreview | null;
  title: string;
  body: string;
  classification?: {
    folderId: string;
    departmentIds: string[];
    topicLabels: string[];
  };
};

export type TemporalUpdateRecord = {
  id: string;
  organizationId: string;
  title: string;
  body: string;
  subjectType: TemporalSubjectType;
  subjectRef: string | null;
  subjectScope: Record<string, unknown>;
  overridePreview: TemporalOverridePreview | null;
  durationMode: "limited" | "ongoing";
  effectiveAt: string;
  expiresAt: string | null;
  reviewReminderAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  hoursOverrideId: string | null;
  trainingItemId: string | null;
  classification: {
    folderId: string;
    departmentIds: string[];
    topicLabels: string[];
  };
  createdAt: string;
  updatedAt: string;
};

export type TemporalWindow = {
  effectiveAt: Date;
  expiresAt: Date | null;
  reviewReminderAt: Date | null;
};

export type TemporalCountdown = {
  lifecycle: TemporalLifecycle;
  primaryLabel: string;
  exactLabel: string;
  remainingMs: number | null;
  isOngoing: boolean;
  isScheduled: boolean;
};

const DEFAULT_TIMEZONE = "Europe/Dublin";

export function resolveBusinessTimezone(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function dayKeyInTimezone(date: Date, timezone: string): DayKey {
  const weekday = formatInTimeZone(date, timezone, "EEEE").toLowerCase();
  return DAY_KEYS.find((day) => day === weekday) ?? "monday";
}

export function resolveTemporalLifecycle(
  row: Pick<
    TemporalUpdateRecord,
    | "effectiveAt"
    | "expiresAt"
    | "endedAt"
    | "cancelledAt"
    | "durationMode"
  >,
  now: Date = new Date(),
): TemporalLifecycle {
  if (row.cancelledAt) return "cancelled";
  if (row.endedAt) return "ended";
  const effectiveAt = new Date(row.effectiveAt);
  const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
  if (Number.isNaN(effectiveAt.getTime())) return "expired";
  if (isBefore(now, effectiveAt)) return "scheduled";
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    if (!isBefore(now, expiresAt)) return "expired";
  }
  return "active";
}

export function isTemporalUpdateVisible(
  row: TemporalUpdateRecord,
  now: Date = new Date(),
): boolean {
  const lifecycle = resolveTemporalLifecycle(row, now);
  return lifecycle === "scheduled" || lifecycle === "active";
}

export function isTemporalUpdateEffective(
  row: TemporalUpdateRecord,
  now: Date = new Date(),
): boolean {
  return resolveTemporalLifecycle(row, now) === "active";
}

export function buildTemporalWindow(
  input: Pick<
    TemporalDraftInput,
    | "durationMode"
    | "startChoice"
    | "startAt"
    | "endChoice"
    | "endAt"
    | "reviewReminderChoice"
  >,
  timezone: string,
  now: Date = new Date(),
): TemporalWindow {
  const effectiveAt =
    input.startChoice === "scheduled" && input.startAt
      ? new Date(input.startAt)
      : now;

  let expiresAt: Date | null = null;
  if (input.durationMode === "limited") {
    if (input.endChoice === "end_of_today") {
      const zoned = toZonedTime(effectiveAt, timezone);
      const dayStart = startOfDay(zoned);
      const nextDay = addDays(dayStart, 1);
      expiresAt = fromZonedTime(nextDay, timezone);
    } else if (input.endChoice === "24h_after_start") {
      expiresAt = addHours(effectiveAt, 24);
    } else if (input.endAt) {
      expiresAt = new Date(input.endAt);
    }
  }

  let reviewReminderAt: Date | null = null;
  if (input.durationMode === "ongoing") {
    const choice = input.reviewReminderChoice ?? "none";
    if (choice === "1d") reviewReminderAt = addHours(effectiveAt, 24);
    if (choice === "3d") reviewReminderAt = addHours(effectiveAt, 72);
    if (choice === "1w") reviewReminderAt = addHours(effectiveAt, 168);
  }

  return { effectiveAt, expiresAt, reviewReminderAt };
}

export function validateTemporalWindow(
  window: TemporalWindow,
  durationMode: TemporalDurationMode,
): { ok: true } | { ok: false; message: string } {
  if (Number.isNaN(window.effectiveAt.getTime())) {
    return { ok: false, message: "Choose a valid start date and time." };
  }
  if (durationMode === "standard" || durationMode === "ongoing") {
    return { ok: true };
  }
  if (!window.expiresAt || Number.isNaN(window.expiresAt.getTime())) {
    return { ok: false, message: "Choose when this update ends." };
  }
  if (
    !isBefore(window.effectiveAt, window.expiresAt) &&
    !isEqual(window.effectiveAt, window.expiresAt)
  ) {
    return { ok: false, message: "End must be after the start time." };
  }
  return { ok: true };
}

export function formatTemporalWindowSummary(
  window: TemporalWindow,
  timezone: string,
): string {
  const start = formatExactTemporalMoment(window.effectiveAt, timezone);
  if (!window.expiresAt) {
    return `Starts ${start} · Until ended`;
  }
  const end = formatExactTemporalMoment(window.expiresAt, timezone);
  return `Starts ${start} · Ends ${end}`;
}

export function formatExactTemporalMoment(date: Date, timezone: string): string {
  const dayLabel = formatInTimeZone(date, timezone, "EEEE d MMM yyyy, h:mmaaa");
  return `${dayLabel} · ${timezone}`;
}

function plural(count: number, unit: string): string {
  return `${count}${unit}`;
}

export function formatTemporalCountdown(
  row: TemporalUpdateRecord,
  timezone: string,
  now: Date = new Date(),
): TemporalCountdown {
  const lifecycle = resolveTemporalLifecycle(row, now);
  const effectiveAt = new Date(row.effectiveAt);
  const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;

  if (lifecycle === "cancelled") {
    return {
      lifecycle,
      primaryLabel: "Cancelled",
      exactLabel: "Cancelled",
      remainingMs: null,
      isOngoing: false,
      isScheduled: false,
    };
  }

  if (lifecycle === "ended") {
    return {
      lifecycle,
      primaryLabel: "Ended",
      exactLabel: row.endedAt
        ? `Ended ${formatExactTemporalMoment(new Date(row.endedAt), timezone)}`
        : "Ended",
      remainingMs: null,
      isOngoing: false,
      isScheduled: false,
    };
  }

  if (lifecycle === "expired") {
    return {
      lifecycle,
      primaryLabel: "Expired",
      exactLabel: expiresAt
        ? `Ended ${formatExactTemporalMoment(expiresAt, timezone)}`
        : "Expired",
      remainingMs: null,
      isOngoing: false,
      isScheduled: false,
    };
  }

  if (lifecycle === "scheduled") {
    return {
      lifecycle,
      primaryLabel: `Scheduled · Starts ${formatRelativeTemporalStart(effectiveAt, timezone, now)}`,
      exactLabel: `Starts ${formatExactTemporalMoment(effectiveAt, timezone)}`,
      remainingMs: effectiveAt.getTime() - now.getTime(),
      isOngoing: false,
      isScheduled: true,
    };
  }

  if (row.durationMode === "ongoing" || !expiresAt) {
    return {
      lifecycle,
      primaryLabel: "Ongoing · Until ended",
      exactLabel: `Started ${formatExactTemporalMoment(effectiveAt, timezone)}`,
      remainingMs: null,
      isOngoing: true,
      isScheduled: false,
    };
  }

  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
  return {
    lifecycle,
    primaryLabel: `Temporary · ${formatRemainingDuration(remainingMs)}`,
    exactLabel: `Ends ${formatExactTemporalMoment(expiresAt, timezone)}`,
    remainingMs,
    isOngoing: false,
    isScheduled: false,
  };
}

export function formatRelativeTemporalStart(
  date: Date,
  timezone: string,
  now: Date = new Date(),
): string {
  const zonedNow = toZonedTime(now, timezone);
  const zonedDate = toZonedTime(date, timezone);
  const today = format(zonedNow, "yyyy-MM-dd");
  const target = format(zonedDate, "yyyy-MM-dd");
  const time = formatInTimeZone(date, timezone, "h:mmaaa").replace(":00", "");
  if (target === today) return `today at ${time}`;
  const tomorrow = format(addDays(zonedNow, 1), "yyyy-MM-dd");
  if (target === tomorrow) return `tomorrow at ${time}`;
  return formatInTimeZone(date, timezone, "EEE d MMM 'at' h:mmaaa").replace(
    ":00",
    "",
  );
}

export function formatRemainingDuration(ms: number): string {
  if (ms <= 0) return "Less than a minute";
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "Less than a minute";
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `Ends in ${plural(days, "d")} ${plural(hours, "h")}`;
  }
  if (hours > 0) {
    return `Ends in ${plural(hours, "h")} ${plural(minutes, "m")}`;
  }
  return `Ends in ${plural(minutes, "m")}`;
}

export function temporalBadgeLabel(countdown: TemporalCountdown): string {
  if (countdown.isScheduled) return "Scheduled";
  if (countdown.isOngoing) return "Ongoing";
  return "Temporary";
}

export function buildTodayHoursOverrideSchedule(input: {
  businessHours: unknown;
  dayKey: DayKey;
  closeTime: string;
  openTime?: string | null;
}): WeekSchedule | null {
  const { schedule } = parseBusinessHoursBundle(input.businessHours);
  const day = schedule[input.dayKey];
  if (!day.open && !input.openTime) return null;
  const next: WeekSchedule = { ...schedule };
  next[input.dayKey] = {
    open: true,
    start: input.openTime ?? day.start,
    end: input.closeTime,
  };
  return next;
}

export function formatHoursRangeLabel(
  schedule: WeekSchedule,
  dayKey: DayKey,
): string | null {
  const day = schedule[dayKey];
  if (!day.open) return "Closed";
  const formatted = formatWeekScheduleForAgent({
    ...schedule,
    [dayKey]: day,
  });
  return formatted.split("\n")[0] ?? null;
}

export function findTemporalConflicts(
  existing: TemporalUpdateRecord[],
  candidate: {
    subjectRef: string | null;
    subjectType: TemporalSubjectType;
    effectiveAt: Date;
    expiresAt: Date | null;
    excludeId?: string;
  },
  now: Date = new Date(),
): TemporalUpdateRecord[] {
  return existing.filter((row) => {
    if (candidate.excludeId && row.id === candidate.excludeId) return false;
    if (row.subjectType !== candidate.subjectType) return false;
    if ((row.subjectRef ?? null) !== (candidate.subjectRef ?? null)) return false;
    const lifecycle = resolveTemporalLifecycle(row, now);
    if (lifecycle === "expired" || lifecycle === "ended" || lifecycle === "cancelled") {
      return false;
    }
    const rowStart = new Date(row.effectiveAt);
    const rowEnd =
      row.durationMode === "ongoing" || !row.expiresAt
        ? null
        : new Date(row.expiresAt);
    const candidateEnd = candidate.expiresAt;
    const rangesOverlap = (
      aStart: Date,
      aEnd: Date | null,
      bStart: Date,
      bEnd: Date | null,
    ) => {
      const aEndMs = aEnd?.getTime() ?? Number.POSITIVE_INFINITY;
      const bEndMs = bEnd?.getTime() ?? Number.POSITIVE_INFINITY;
      return aStart.getTime() < bEndMs && bStart.getTime() < aEndMs;
    };
    return rangesOverlap(rowStart, rowEnd, candidate.effectiveAt, candidateEnd);
  });
}

export function parseTemporalDraft(raw: unknown): TemporalDraftInput | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const durationMode = row.durationMode;
  if (durationMode !== "limited" && durationMode !== "ongoing") return null;
  const subjectType = row.subjectType;
  if (typeof subjectType !== "string") return null;
  return {
    durationMode,
    startChoice: row.startChoice === "scheduled" ? "scheduled" : "now",
    startAt: typeof row.startAt === "string" ? row.startAt : null,
    endChoice:
      row.endChoice === "end_of_today" ||
      row.endChoice === "24h_after_start" ||
      row.endChoice === "scheduled"
        ? row.endChoice
        : null,
    endAt: typeof row.endAt === "string" ? row.endAt : null,
    reviewReminderChoice:
      row.reviewReminderChoice === "1d" ||
      row.reviewReminderChoice === "3d" ||
      row.reviewReminderChoice === "1w"
        ? row.reviewReminderChoice
        : "none",
    subjectType: subjectType as TemporalSubjectType,
    subjectRef: typeof row.subjectRef === "string" ? row.subjectRef : null,
    subjectScope:
      row.subjectScope && typeof row.subjectScope === "object"
        ? (row.subjectScope as Record<string, unknown>)
        : {},
    overridePreview:
      row.overridePreview && typeof row.overridePreview === "object"
        ? (row.overridePreview as TemporalOverridePreview)
        : null,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    classification:
      row.classification && typeof row.classification === "object"
        ? {
            folderId: String(
              (row.classification as Record<string, unknown>).folderId ?? "general",
            ),
            departmentIds: Array.isArray(
              (row.classification as Record<string, unknown>).departmentIds,
            )
              ? ((row.classification as Record<string, unknown>)
                  .departmentIds as string[])
              : [],
            topicLabels: Array.isArray(
              (row.classification as Record<string, unknown>).topicLabels,
            )
              ? ((row.classification as Record<string, unknown>)
                  .topicLabels as string[])
              : [],
          }
        : undefined,
  };
}

export function rowToTemporalUpdate(row: Record<string, unknown>): TemporalUpdateRecord {
  const classificationRaw =
    row.classification && typeof row.classification === "object"
      ? (row.classification as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    subjectType: String(row.subject_type) as TemporalSubjectType,
    subjectRef: row.subject_ref ? String(row.subject_ref) : null,
    subjectScope:
      row.subject_scope && typeof row.subject_scope === "object"
        ? (row.subject_scope as Record<string, unknown>)
        : {},
    overridePreview:
      row.override_preview && typeof row.override_preview === "object"
        ? (row.override_preview as TemporalOverridePreview)
        : null,
    durationMode: row.duration_mode === "ongoing" ? "ongoing" : "limited",
    effectiveAt: String(row.effective_at),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    reviewReminderAt: row.review_reminder_at
      ? String(row.review_reminder_at)
      : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    hoursOverrideId: row.hours_override_id ? String(row.hours_override_id) : null,
    trainingItemId: row.training_item_id ? String(row.training_item_id) : null,
    classification: {
      folderId: String(classificationRaw.folderId ?? "general"),
      departmentIds: Array.isArray(classificationRaw.departmentIds)
        ? (classificationRaw.departmentIds as string[])
        : [],
      topicLabels: Array.isArray(classificationRaw.topicLabels)
        ? (classificationRaw.topicLabels as string[])
        : [],
    },
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
