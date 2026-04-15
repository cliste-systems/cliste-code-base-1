import { addWeeks, startOfWeek } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import {
  addDaysToYmd,
  todayYmdInTimeZone,
} from "@/lib/booking-available-slots";

import type { CaraNearTermAppointment } from "@/lib/cara-near-term-appointments";

export type CaraCancelIntentResult =
  | { tag: "no_intent" }
  | { tag: "not_found"; cancelIntent: true }
  | { tag: "ambiguous"; cancelIntent: true }
  | {
      tag: "resolved";
      cancelIntent: true;
      appointmentId: string;
      summary: string;
    };

/** Matches when the salon owner (not Cara’s prior replies) is asking to cancel. */
const CANCEL_RE =
  /\b(cancel|cancellation|call off|unbook|un-book|don'?t need|do not need|remove (?:the )?(?:booking|appointment)|delete (?:the )?(?:booking|appointment))\b/i;

const NON_NAME_FOLLOWUP_SINGLE = new Set(
  [
    "what",
    "whats",
    "how",
    "when",
    "where",
    "which",
    "why",
    "booking",
    "bookings",
    "value",
    "values",
    "cliste",
    "cara",
    "thanks",
    "thank",
    "hello",
    "hey",
    "hi",
    "help",
    "open",
    "show",
    "tell",
    "give",
    "need",
    "want",
    "last",
    "first",
    "from",
    "with",
    "into",
    "onto",
    "see",
    "look",
    "looking",
    "dashboard",
    "stats",
    "numbers",
    "weeks",
    "days",
    "clients",
    "services",
    "team",
    "calls",
    "handled",
    "revenue",
    "money",
    "euro",
    "eur",
  ].map((s) => s.toLowerCase()),
);

/**
 * Short follow-up after the user already said “cancel …” (must not match normal questions).
 */
function isCancelFollowUpMessage(userMessage: string): boolean {
  const t = userMessage.trim();
  if (!t || t.length > 96) return false;
  const lower = t.toLowerCase();
  if (/^(yes|yeah|yep|sure|ok|okay|please|do it|do that)\.?!?$/i.test(lower)) {
    return true;
  }
  if (/^that one\.?!?$/i.test(lower)) return true;
  if (/^i\s+said\b/i.test(lower) && /\b(next|tomorrow|today|week)\b/i.test(lower)) {
    return true;
  }
  if (/^next\s*week\b/i.test(lower) && t.length < 28) return true;
  if (/^this\s*week\b/i.test(lower) && t.length < 28) return true;
  if (/^(tomorrow|today|tonight)\b/i.test(lower) && t.length < 24) return true;
  if (
    /^[a-zà-ÿ][a-zà-ÿ'.-]{1,30}$/i.test(lower) &&
    !NON_NAME_FOLLOWUP_SINGLE.has(lower)
  ) {
    return true;
  }
  return false;
}

const WEEKDAY_TO_JS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const NAME_STOPWORDS = new Set(
  [
    "the",
    "and",
    "for",
    "you",
    "that",
    "this",
    "with",
    "from",
    "can",
    "not",
    "but",
    "all",
    "any",
    "are",
    "was",
    "were",
    "don",
    "cant",
    "say",
    "open",
    "please",
    "next",
    "week",
    "cancel",
    "cancelled",
    "cancellation",
    "appointment",
    "appointments",
    "booking",
    "bookings",
    "remove",
    "delete",
    "need",
    "call",
    "off",
    "unbook",
    "today",
    "tomorrow",
    "tonight",
    "morning",
    "afternoon",
    "evening",
    "said",
    "after",
    "before",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "app",
    "one",
    "two",
    "out",
    "get",
    "got",
    "let",
    "use",
    "using",
  ].map((s) => s.toLowerCase()),
);

/** Wall-clock minutes from midnight in `tz` for an ISO instant. */
function zonedMinutesFromMidnight(iso: string, tz: string): number {
  const d = toZonedTime(new Date(iso), tz);
  return d.getHours() * 60 + d.getMinutes();
}

function ymdInTz(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd");
}

function jsWeekday(iso: string, tz: string): number {
  return toZonedTime(new Date(iso), tz).getDay();
}

/** [loYmd, hiExclusiveYmd) for the ISO week after the current one (Mon–Sun, Europe-style weekStartsOn Monday). */
function nextCalendarWeekYmdBounds(
  tz: string,
  now: Date = new Date(),
): { loYmd: string; hiExclusiveYmd: string } {
  const z = toZonedTime(now, tz);
  const monThis = startOfWeek(z, { weekStartsOn: 1 });
  const monNext = addWeeks(monThis, 1);
  const monAfter = addWeeks(monNext, 1);
  return {
    loYmd: formatInTimeZone(monNext, tz, "yyyy-MM-dd"),
    hiExclusiveYmd: formatInTimeZone(monAfter, tz, "yyyy-MM-dd"),
  };
}

function thisCalendarWeekYmdBounds(
  tz: string,
  now: Date = new Date(),
): { loYmd: string; hiExclusiveYmd: string } {
  const z = toZonedTime(now, tz);
  const monThis = startOfWeek(z, { weekStartsOn: 1 });
  const monNext = addWeeks(monThis, 1);
  return {
    loYmd: formatInTimeZone(monThis, tz, "yyyy-MM-dd"),
    hiExclusiveYmd: formatInTimeZone(monNext, tz, "yyyy-MM-dd"),
  };
}

function ymdInHalfOpenRange(
  ymd: string,
  loYmd: string,
  hiExclusiveYmd: string,
): boolean {
  return ymd >= loYmd && ymd < hiExclusiveYmd;
}

function extractNameHints(userMessage: string, recentTranscript: string): string[] {
  const text = `${userMessage}\n${recentTranscript}`.toLowerCase();
  const tokens = text
    .split(/[^a-zà-ÿ]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !NAME_STOPWORDS.has(t));
  const uniq: string[] = [];
  for (const t of tokens) {
    if (!uniq.includes(t)) uniq.push(t);
  }
  return uniq.slice(0, 8);
}

function extractWeekdayJs(combined: string): number | null {
  const m = combined.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (!m?.[1]) return null;
  return WEEKDAY_TO_JS[m[1].toLowerCase()] ?? null;
}

type ParsedClock = { hour: number; minute: number };

function extractClockTimes(text: string): ParsedClock[] {
  const lower = text.toLowerCase();
  const out: ParsedClock[] = [];

  const re12 = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re12.exec(lower)) !== null) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = m[3]!.toLowerCase();
    if (!Number.isFinite(h) || !Number.isFinite(min)) continue;
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h < 0 || h > 23 || min < 0 || min > 59) continue;
    out.push({ hour: h, minute: min });
  }

  const re24 = /\b(\d{1,2}):(\d{2})\b/g;
  while ((m = re24.exec(lower)) !== null) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) continue;
    if (h < 0 || h > 23 || min < 0 || min > 59) continue;
    out.push({ hour: h, minute: min });
  }

  return out;
}

function clockToMinutes(c: ParsedClock): number {
  return c.hour * 60 + c.minute;
}

function appointmentSummary(a: CaraNearTermAppointment, tz: string): string {
  const when = formatInTimeZone(
    new Date(a.start_time),
    tz,
    "EEE d MMM, h:mm a",
  );
  return `${a.customer_name} · ${when}`;
}

function tryResolvePool(
  pool: CaraNearTermAppointment[],
  tz: string,
): CaraCancelIntentResult | null {
  if (pool.length === 1) {
    const a = pool[0]!;
    return {
      tag: "resolved",
      cancelIntent: true,
      appointmentId: a.id,
      summary: appointmentSummary(a, tz),
    };
  }
  if (pool.length > 1) {
    return { tag: "ambiguous", cancelIntent: true };
  }
  return null;
}

function narrowByName(
  pool: CaraNearTermAppointment[],
  hints: string[],
): CaraNearTermAppointment[] {
  if (hints.length === 0) return pool;
  const named = pool.filter((a) => {
    const n = a.customer_name.toLowerCase();
    return hints.some((h) => n.includes(h));
  });
  return named.length > 0 ? named : pool;
}

/**
 * Server-side resolver: maps natural language + upcoming rows to at most one appointment.
 */
export function resolveCancelAppointmentIntent(opts: {
  userMessage: string;
  /** Last N turns (user + assistant) for time/name context only. */
  recentTranscript: string;
  /** Recent user lines only — cancel intent must never latch on Cara saying “cancellation”. */
  recentUserTranscript: string;
  candidates: CaraNearTermAppointment[];
  timeZone: string;
}): CaraCancelIntentResult {
  const userMsg = opts.userMessage.trim();
  const recentUser = opts.recentUserTranscript.trim();
  const userAskedCancel = CANCEL_RE.test(userMsg);
  const hadCancelInRecentUser = CANCEL_RE.test(recentUser);
  const cancelIntent =
    userAskedCancel ||
    (hadCancelInRecentUser && isCancelFollowUpMessage(userMsg));

  if (!cancelIntent) {
    return { tag: "no_intent" };
  }

  const combined = `${opts.recentTranscript}\n${opts.userMessage}`.trim();

  const tz = opts.timeZone;
  const todayYmd = todayYmdInTimeZone(tz);
  const tomorrowYmd = addDaysToYmd(todayYmd, 1, tz);

  const wantsTomorrow = /\b(tomorrow|tmrw|tmr)\b/i.test(combined);
  const wantsToday =
    /\b(today|tonight|this afternoon|this morning|this evening)\b/i.test(
      combined,
    );
  const wantsNextWeek =
    /\bnext\s+week\b/i.test(combined) ||
    /\b(?:the\s+)?following\s+week\b/i.test(combined);
  const wantsThisWeek = /\bthis\s+week\b/i.test(combined);

  const hints = extractNameHints(opts.userMessage, opts.recentTranscript);
  const weekdayJs = extractWeekdayJs(combined);
  const clocks = extractClockTimes(combined);
  const lastClock = clocks.length ? clocks[clocks.length - 1] : null;

  const attempts: (() => CaraNearTermAppointment[])[] = [];

  attempts.push(() => {
    let pool = opts.candidates;
    pool = narrowByName(pool, hints);

    if (wantsNextWeek && !wantsThisWeek) {
      const { loYmd, hiExclusiveYmd } = nextCalendarWeekYmdBounds(tz);
      pool = pool.filter((a) =>
        ymdInHalfOpenRange(ymdInTz(a.start_time, tz), loYmd, hiExclusiveYmd),
      );
    } else if (wantsThisWeek && !wantsNextWeek) {
      const { loYmd, hiExclusiveYmd } = thisCalendarWeekYmdBounds(tz);
      pool = pool.filter((a) =>
        ymdInHalfOpenRange(ymdInTz(a.start_time, tz), loYmd, hiExclusiveYmd),
      );
    } else if (wantsToday && !wantsTomorrow) {
      pool = pool.filter((a) => ymdInTz(a.start_time, tz) === todayYmd);
    } else if (wantsTomorrow && !wantsToday) {
      pool = pool.filter((a) => ymdInTz(a.start_time, tz) === tomorrowYmd);
    }

    if (weekdayJs != null) {
      pool = pool.filter((a) => jsWeekday(a.start_time, tz) === weekdayJs);
    }

    if (lastClock != null) {
      const target = clockToMinutes(lastClock);
      const timed = pool.filter((a) => {
        const m = zonedMinutesFromMidnight(a.start_time, tz);
        return Math.abs(m - target) <= 35;
      });
      if (timed.length > 0) pool = timed;
    }

    return pool;
  });

  attempts.push(() => {
    let pool = opts.candidates;
    pool = narrowByName(pool, hints);
    if (wantsNextWeek && !wantsThisWeek) {
      const { loYmd, hiExclusiveYmd } = nextCalendarWeekYmdBounds(tz);
      pool = pool.filter((a) =>
        ymdInHalfOpenRange(ymdInTz(a.start_time, tz), loYmd, hiExclusiveYmd),
      );
    } else if (wantsThisWeek && !wantsNextWeek) {
      const { loYmd, hiExclusiveYmd } = thisCalendarWeekYmdBounds(tz);
      pool = pool.filter((a) =>
        ymdInHalfOpenRange(ymdInTz(a.start_time, tz), loYmd, hiExclusiveYmd),
      );
    } else if (wantsToday && !wantsTomorrow) {
      pool = pool.filter((a) => ymdInTz(a.start_time, tz) === todayYmd);
    } else if (wantsTomorrow && !wantsToday) {
      pool = pool.filter((a) => ymdInTz(a.start_time, tz) === tomorrowYmd);
    }
    if (weekdayJs != null) {
      pool = pool.filter((a) => jsWeekday(a.start_time, tz) === weekdayJs);
    }
    return pool;
  });

  attempts.push(() => {
    let pool = opts.candidates;
    if (wantsNextWeek && !wantsThisWeek) {
      const { loYmd, hiExclusiveYmd } = nextCalendarWeekYmdBounds(tz);
      pool = pool.filter((a) =>
        ymdInHalfOpenRange(ymdInTz(a.start_time, tz), loYmd, hiExclusiveYmd),
      );
    }
    if (weekdayJs != null) {
      pool = pool.filter((a) => jsWeekday(a.start_time, tz) === weekdayJs);
    }
    pool = narrowByName(pool, hints);
    return pool;
  });

  attempts.push(() => {
    let pool = opts.candidates;
    pool = narrowByName(pool, hints);
    if (weekdayJs != null) {
      pool = pool.filter((a) => jsWeekday(a.start_time, tz) === weekdayJs);
    }
    return pool;
  });

  attempts.push(() => {
    let pool = opts.candidates;
    if (lastClock != null) {
      const target = clockToMinutes(lastClock);
      pool = pool.filter((a) => {
        const m = zonedMinutesFromMidnight(a.start_time, tz);
        return Math.abs(m - target) <= 35;
      });
    }
    pool = narrowByName(pool, hints);
    return pool;
  });

  attempts.push(() => {
    let pool = opts.candidates;
    pool = narrowByName(pool, hints);
    return pool;
  });

  for (const run of attempts) {
    const pool = run();
    const hit = tryResolvePool(pool, tz);
    if (hit) return hit;
  }

  if (opts.candidates.length === 1 && !wantsTomorrow && !wantsToday) {
    const a = opts.candidates[0]!;
    return {
      tag: "resolved",
      cancelIntent: true,
      appointmentId: a.id,
      summary: appointmentSummary(a, tz),
    };
  }

  return { tag: "not_found", cancelIntent: true };
}
