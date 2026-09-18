import {
  DAY_KEYS,
  parseBusinessHoursBundle,
  type DayKey,
} from "@/lib/business-hours";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import { faqKnowledgeEntryId } from "@/lib/cara-knowledge-index";
import type {
  TemporalDraftInput,
  TemporalOverridePreview,
  TemporalSubjectType,
} from "@/lib/cara-knowledge-temporal";
import {
  buildTemporalWindow,
  buildTodayHoursOverrideSchedule,
  dayKeyInTimezone,
  formatHoursRangeLabel,
  resolveBusinessTimezone,
} from "@/lib/cara-knowledge-temporal";

const HOURS_INTENT_RE =
  /\b(opening hours|open hours|closing time|close at|closing at|close early|closing early|shut at|shut early|we(?:'|’)re closing|we close|closing today|close today)\b/i;
const TODAY_SCOPE_RE = /\b(today|this evening|tonight|rest of today)\b/i;
const TIME_TOKEN_RE =
  /\b(?:at|by|until)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i;
const ONGOING_DISRUPTION_RE =
  /\b(unavailable|not working|out of order|cannot accept|can(?:'|’)t accept|not accepting|down until further notice)\b/i;
const PRICE_INTENT_RE =
  /\b(promo(?:tion|tional)?|special price|offer price|reduced to|now (?:only )?€|€[\d,.]+)\b/i;

function parseTimeToken(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
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

function extractClosingTime(text: string): string | null {
  const match = text.match(TIME_TOKEN_RE);
  if (!match?.[1]) return null;
  return parseTimeToken(match[1]);
}

function extractHoursRangeFromText(text: string): {
  open: string | null;
  close: string | null;
} {
  const rangeMatch = text.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:–|—|-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    return {
      open: parseTimeToken(rangeMatch[1]),
      close: parseTimeToken(rangeMatch[2]),
    };
  }
  return { open: null, close: extractClosingTime(text) };
}

function formatTime12h(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const hours = Number(hRaw);
  const minutes = Number(mRaw);
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  if (minutes === 0) return `${hour12}${period}`;
  return `${hour12}:${String(minutes).padStart(2, "0")}${period}`;
}

export type TemporalSubjectSuggestion = {
  subjectType: TemporalSubjectType;
  subjectRef: string | null;
  subjectScope: Record<string, unknown>;
  title: string;
  body: string;
  overridePreview: TemporalOverridePreview | null;
  confidence: "high" | "medium" | "low";
  needsConfirmation: boolean;
};

export function suggestTemporalSubject(input: {
  text: string;
  businessHours?: unknown;
  openingHoursText?: string | null;
  timezone?: string | null;
  faqQuestions?: string[];
  now?: Date;
}): TemporalSubjectSuggestion {
  const text = input.text.trim();
  const timezone = resolveBusinessTimezone(input.timezone);
  const now = input.now ?? new Date();
  const lower = text.toLowerCase();

  if (HOURS_INTENT_RE.test(text) && (TODAY_SCOPE_RE.test(text) || /close|closing|shut/.test(lower))) {
    const { open: openTime, close: closeTime } = extractHoursRangeFromText(text);
    const dayKey = dayKeyInTimezone(now, timezone);
    const { schedule } = parseBusinessHoursBundle(input.businessHours);
    const day = schedule[dayKey];
    const normalBody =
      day.open && day.start && day.end
        ? `${formatTime12h(day.start)}–${formatTime12h(day.end)}`
        : String(input.openingHoursText ?? "").trim() || null;
    const temporaryBody =
      openTime && closeTime
        ? `${formatTime12h(openTime)}–${formatTime12h(closeTime)}`
        : closeTime
          ? day.open && day.start
            ? `${formatTime12h(day.start)}–${formatTime12h(closeTime)}`
            : `Closing at ${formatTime12h(closeTime)}`
          : text;
    const preview: TemporalOverridePreview = {
      normalLabel: "Usual hours",
      normalBody,
      temporaryLabel: "Temporary opening hours",
      temporaryBody,
      scopeLabel: "Today only",
      afterExpiryNote: normalBody
        ? "The usual schedule applies again after this ends."
        : null,
    };
    return {
      subjectType: "opening_hours",
      subjectRef: "fact-hours",
      subjectScope: { dayKey, scope: "today" },
      title: "Temporary opening hours",
      body: temporaryBody,
      overridePreview: preview,
      confidence: closeTime ? "high" : "medium",
      needsConfirmation: !closeTime,
    };
  }

  if (PRICE_INTENT_RE.test(text)) {
    return {
      subjectType: "price",
      subjectRef: null,
      subjectScope: {},
      title: "Temporary price",
      body: text,
      overridePreview: {
        normalLabel: "Usual price",
        normalBody: null,
        temporaryLabel: "Promotional price",
        temporaryBody: text,
        scopeLabel: "During the offer period",
        afterExpiryNote: "The current normal price applies again when the offer ends.",
      },
      confidence: "medium",
      needsConfirmation: true,
    };
  }

  if (ONGOING_DISRUPTION_RE.test(text)) {
    return {
      subjectType: "notice",
      subjectRef: null,
      subjectScope: {},
      title: text.slice(0, 80),
      body: text,
      overridePreview: null,
      confidence: "medium",
      needsConfirmation: false,
    };
  }

  const faqMatch = (input.faqQuestions ?? []).find((question) => {
    const q = question.toLowerCase();
    return text.length > 12 && (q.includes(lower.slice(0, 20)) || lower.includes(q.slice(0, 20)));
  });
  if (faqMatch) {
    return {
      subjectType: "faq",
      subjectRef: faqKnowledgeEntryId(faqMatch),
      subjectScope: {},
      title: faqMatch,
      body: text,
      overridePreview: {
        normalLabel: "Usual answer",
        normalBody: null,
        temporaryLabel: "Temporary answer",
        temporaryBody: text,
        scopeLabel: "During this update",
        afterExpiryNote: "The usual answer applies again after this ends.",
      },
      confidence: "medium",
      needsConfirmation: true,
    };
  }

  return {
    subjectType: "notice",
    subjectRef: null,
    subjectScope: {},
    title: text.slice(0, 80),
    body: text,
    overridePreview: null,
    confidence: "low",
    needsConfirmation: false,
  };
}

export function buildTemporalDraftFromTeach(input: {
  text: string;
  classification: {
    folderId: string;
    departmentIds: string[];
    topicLabels: string[];
  };
  durationMode: "limited" | "ongoing";
  startChoice: TemporalDraftInput["startChoice"];
  startAt?: string | null;
  endChoice?: TemporalDraftInput["endChoice"];
  endAt?: string | null;
  reviewReminderChoice?: TemporalDraftInput["reviewReminderChoice"];
  businessHours?: unknown;
  openingHoursText?: string | null;
  timezone?: string | null;
}): TemporalDraftInput {
  const suggestion = suggestTemporalSubject({
    text: input.text,
    businessHours: input.businessHours,
    openingHoursText: input.openingHoursText,
    timezone: input.timezone,
  });
  return {
    durationMode: input.durationMode,
    startChoice: input.startChoice,
    startAt: input.startAt ?? null,
    endChoice: input.endChoice ?? null,
    endAt: input.endAt ?? null,
    reviewReminderChoice: input.reviewReminderChoice ?? "none",
    subjectType: suggestion.subjectType,
    subjectRef: suggestion.subjectRef,
    subjectScope: suggestion.subjectScope,
    overridePreview: suggestion.overridePreview,
    title: suggestion.title,
    body: suggestion.body,
    classification: input.classification,
  };
}

export function buildHoursOverrideForDraft(input: {
  draft: TemporalDraftInput;
  businessHours: unknown;
  timezone: string;
  now?: Date;
}): {
  schedule: NonNullable<ReturnType<typeof buildTodayHoursOverrideSchedule>>;
  label: string;
  expiresAt: Date;
} | null {
  if (input.draft.subjectType !== "opening_hours") return null;
  const dayKey = String(input.draft.subjectScope?.dayKey ?? "") as DayKey;
  if (!DAY_KEYS.includes(dayKey)) return null;
  const { open: openTime, close: closeTime } = extractHoursRangeFromText(
    input.draft.body,
  );
  if (!closeTime) return null;
  const schedule = buildTodayHoursOverrideSchedule({
    businessHours: input.businessHours,
    dayKey,
    closeTime,
    openTime,
  });
  if (!schedule) return null;
  const formattedDay = formatHoursRangeLabel(schedule, dayKey);
  const usual = formatWeekScheduleForAgent(
    parseBusinessHoursBundle(input.businessHours).schedule,
  );
  const window = buildTemporalWindow(input.draft, input.timezone, input.now);
  return {
    schedule,
    label: formattedDay
      ? `Temporary hours today: ${formattedDay}. Usual schedule: ${usual.split("\n")[0] ?? usual}`
      : "Temporary opening hours for today",
    expiresAt: window.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}
