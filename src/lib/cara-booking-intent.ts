import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import {
  isPlausibleCustomerPhoneE164,
  normalizeCustomerPhoneE164,
} from "@/lib/booking-reference";

const BOOKING_INTENT_RE =
  /\b(book|booked|booking|appointment|appointments|reserve|scheduled?|creat|cret)\w*\b/i;

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const PHONE_RE =
  /(\+353\s*\d{2}\s*\d{3}\s*\d{4}|\+353\d{9}|\+44\d{10,11}|08\d[\d\s]{7,11})/i;

/** Chronological user lines in this thread (including the current message). */
export function buildCaraBookingUserContextBlobFromRows(
  userContentsChronological: readonly string[],
  maxChars = 4000,
): string {
  return userContentsChronological
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n")
    .slice(-maxChars);
}

export type CaraBookingIntentResult =
  | { tag: "skip" }
  | { tag: "reject"; reply: string }
  | {
      tag: "create";
      customerName: string;
      customerPhone: string;
      serviceId: string;
      startTimeIso: string;
      summaryForReply: string;
    };

function extractPhone(raw: string): string | null {
  const m = raw.match(PHONE_RE);
  if (!m) return null;
  const compact = m[1]!.replace(/\s/g, "");
  const n = normalizeCustomerPhoneE164(compact);
  if (!isPlausibleCustomerPhoneE164(n)) return null;
  return m[1]!.trim();
}

function parseHourMinute(text: string): { hour24: number; minute: number } | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return null;
  let h = Number.parseInt(m[1]!, 10);
  const mi = m[2] ? Number.parseInt(m[2], 10) : 0;
  const ap = m[3]!.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { hour24: h, minute: mi };
}

function resolveNumericDateWithOptionalTime(
  text: string,
  tz: string,
  now: Date,
): string | null {
  const m = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
  if (!m) return null;
  const d = Number.parseInt(m[1]!, 10);
  const mo = Number.parseInt(m[2]!, 10);
  let y = Number.parseInt(m[3]!, 10);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const lower = text.toLowerCase();
  const hm = parseHourMinute(lower);
  const h = hm?.hour24 ?? 12;
  const mi = hm?.minute ?? 0;
  const ymd = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const inst = fromZonedTime(
    `${ymd}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00`,
    tz,
  );
  if (Number.isNaN(inst.getTime())) return null;
  if (inst.getTime() < now.getTime() - 120_000) return null;
  return inst.toISOString();
}

function resolveStartIsoInSalonTz(
  text: string,
  tz: string,
  now: Date,
): string | null {
  const lower = text.toLowerCase();
  const hm = parseHourMinute(lower);

  const numeric = resolveNumericDateWithOptionalTime(text, tz, now);
  if (numeric) return numeric;

  if (!hm) return null;

  const dMatch = lower.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  const wantName = dMatch?.[1]?.toLowerCase() as
    | (typeof WEEKDAY_NAMES)[number]
    | undefined;

  if (/\btomorrow\b/i.test(lower) && !wantName) {
    const ymd = formatInTimeZone(addDays(now, 1), tz, "yyyy-MM-dd");
    return fromZonedTime(
      `${ymd}T${String(hm.hour24).padStart(2, "0")}:${String(hm.minute).padStart(2, "0")}:00`,
      tz,
    ).toISOString();
  }

  if (/\btoday\b/i.test(lower) && !wantName) {
    const ymd = formatInTimeZone(now, tz, "yyyy-MM-dd");
    const inst = fromZonedTime(
      `${ymd}T${String(hm.hour24).padStart(2, "0")}:${String(hm.minute).padStart(2, "0")}:00`,
      tz,
    );
    return inst.toISOString();
  }

  if (!wantName || !WEEKDAY_NAMES.includes(wantName)) {
    return null;
  }

  for (let i = 0; i < 21; i++) {
    const ymd = formatInTimeZone(addDays(now, i), tz, "yyyy-MM-dd");
    const noon = fromZonedTime(`${ymd}T12:00:00`, tz);
    const wd = formatInTimeZone(noon, tz, "EEEE").toLowerCase();
    if (wd !== wantName) continue;

    const inst = fromZonedTime(
      `${ymd}T${String(hm.hour24).padStart(2, "0")}:${String(hm.minute).padStart(2, "0")}:00`,
      tz,
    );
    if (inst.getTime() <= now.getTime()) continue;
    return inst.toISOString();
  }
  return null;
}

type ServicePick =
  | { ok: true; id: string; displayName: string }
  | { ok: false; reason: "ambiguous"; names: string[] }
  | { ok: false; reason: "none" };

function pickService(
  messageLower: string,
  parts: string[],
  services: { id: string; name: string }[],
): ServicePick {
  const scored: { id: string; name: string; score: number }[] = [];
  for (const sv of services) {
    const n = sv.name.toLowerCase().trim();
    if (!n) continue;
    let score = 0;
    if (messageLower.includes(n)) score += n.length + 12;
    for (const p of parts) {
      const t = p.toLowerCase().trim();
      if (!t) continue;
      if (t === n) score += 220;
      else if (t.length >= 2 && (n.includes(t) || t.includes(n))) {
        score += Math.min(n.length, t.length) + 2;
      }
    }
    if (score > 0) scored.push({ id: sv.id, name: sv.name, score });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { ok: false, reason: "none" };
  const top = scored[0]!;
  const second = scored[1];
  if (second && second.score >= top.score - 1 && second.score > 0) {
    return { ok: false, reason: "ambiguous", names: [top.name, second.name] };
  }
  return { ok: true, id: top.id, displayName: top.name };
}

function inferCustomerName(
  parts: string[],
  services: { name: string }[],
  phoneRaw: string,
): string | null {
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  const tail = phoneDigits.slice(-7);

  for (const p of parts) {
    const t = p.trim();
    if (t.length < 2 || t.length > 48) continue;
    const digits = t.replace(/\D/g, "");
    if (tail && digits.includes(tail)) continue;
    if (/\b\d{1,2}\s*:?\s*\d{0,2}\s*(am|pm)\b/i.test(t)) continue;
    if (
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i.test(
        t,
      )
    ) {
      continue;
    }
    const tl = t.toLowerCase();
    if (services.some((s) => tl.includes(s.name.toLowerCase()))) continue;
    if (!/^[a-zA-Z .'-]+$/.test(t)) continue;
    if (looksLikeNonNamePhrase(t)) continue;
    if (/\b(book|booking|appointment|schedule|reserve)\b/i.test(t)) continue;
    if (BOOKING_INTENT_RE.test(t) && t.length > 18) continue;
    return t.replace(/\s+/g, " ").trim();
  }
  return null;
}

const CALENDARISH_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

const NON_NAME_WORDS = new Set([
  "hey",
  "hi",
  "hello",
  "yo",
  "thanks",
  "thankyou",
  "please",
  "client",
  "customer",
  "guest",
  "person",
  "someone",
]);

function looksLikeNonNamePhrase(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  if (words.length === 1 && NON_NAME_WORDS.has(words[0]!)) return true;
  if (words.every((w) => NON_NAME_WORDS.has(w))) return true;
  if (/^(a|an|the)\s+(client|customer|guest|person|someone)$/.test(t)) {
    return true;
  }
  return false;
}

function tokenLooksLikeServiceWord(word: string, services: { name: string }[]): boolean {
  const w = word.toLowerCase();
  if (w.length < 3) return false;
  return services.some((s) => {
    const n = s.name.toLowerCase();
    return n === w || n.includes(w) || w.includes(n);
  });
}

/**
 * When the owner sends one line like “book in John for a fade Monday 1pm …”
 * (no commas), comma-split “parts” never yields a short name segment—recover
 * from common “book in NAME / NAME for a …” patterns instead.
 */
function inferCustomerNameFromFullText(
  full: string,
  services: { name: string }[],
  phoneRaw: string,
): string | null {
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  const tail = phoneDigits.slice(-7);
  const scrubbed = full.replace(PHONE_RE, " ");
  const lower = scrubbed.toLowerCase();

  const finalize = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const t = raw.trim();
    if (t.length < 2 || t.length > 40) return null;
    if (/\d/.test(t)) return null;
    const tl = t.toLowerCase();
    if (CALENDARISH_RE.test(tl)) return null;
    if (tokenLooksLikeServiceWord(tl, services)) return null;
    if (looksLikeNonNamePhrase(t)) return null;
    if (/\b(book|booking|appointment|schedule|reserve|slot)\b/i.test(tl)) return null;
    const digitsInToken = tl.replace(/\D/g, "");
    if (tail && digitsInToken.includes(tail)) return null;
    if (!/^[a-zA-Z .'-]+$/.test(t)) return null;
    return tl.charAt(0).toUpperCase() + tl.slice(1);
  };

  let m = lower.match(/\bbook(?:ing)?\s+in\s+([a-z][a-z'.-]*)\b/);
  const a = finalize(m?.[1]);
  if (a) return a;

  m = lower.match(/\bbook(?:ing)?\s+([a-z][a-z'.-]{1,18})\s+for\b/);
  const b = finalize(m?.[1]);
  if (b) return b;

  m = lower.match(/\b([a-z][a-z'.-]{1,18})\s+for\s+a\s+[a-z]/);
  const c = finalize(m?.[1]);
  if (c) return c;

  return null;
}

/**
 * Detects a “book this” style message on native tier and extracts fields for
 * {@link createDashboardAppointment}. Returns skip when not clearly a booking request.
 *
 * @param latestUserMessage — the message just sent (used for empty check).
 * @param bookingUserContextBlob — recent user lines joined with newlines (same thread), so a bare
 *   “20/04/2026” reply can complete a booking that already named service, time, and phone.
 */
export function tryCaraBookingFromMessage(
  latestUserMessage: string,
  bookingUserContextBlob: string,
  services: { id: string; name: string; duration_minutes: number }[],
  tz: string,
  now: Date,
): CaraBookingIntentResult {
  const trimmedLatest = latestUserMessage.trim();
  if (!trimmedLatest) return { tag: "skip" };

  const bag = (bookingUserContextBlob.trim() || trimmedLatest).trim();
  if (!bag) return { tag: "skip" };

  if (!BOOKING_INTENT_RE.test(bag)) return { tag: "skip" };
  if (services.length === 0) return { tag: "skip" };

  const phoneRaw = extractPhone(bag);
  if (!phoneRaw) return { tag: "skip" };

  const splitParts = bag
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const parts =
    splitParts.length > 0 && splitParts[splitParts.length - 1] === bag
      ? splitParts
      : [...splitParts, bag];

  const messageLower = bag.toLowerCase();
  const svc = pickService(messageLower, parts, services);
  if (!svc.ok) {
    if (svc.reason === "none") {
      return {
        tag: "reject",
        reply:
          "I need one service name from your published menu (spell it like it appears in Bookings, e.g. the exact cut or colour).",
      };
    }
    return {
      tag: "reject",
      reply: `I matched more than one service (${svc.names.join(" · ")}). Say exactly which one you want.`,
    };
  }

  const startIso = resolveStartIsoInSalonTz(bag, tz, now);
  if (!startIso) {
    return {
      tag: "reject",
      reply:
        "I need a clear day and time (for example “1pm Monday”, “20/04/2026 1pm”, or “tomorrow 10:30am”) in your salon’s timezone.",
    };
  }

  let customerName = inferCustomerName(parts, services, phoneRaw);
  if (!customerName) {
    customerName = inferCustomerNameFromFullText(bag, services, phoneRaw);
  }
  if (!customerName) {
    return {
      tag: "reject",
      reply:
        "Who is the visit for? Add the client’s name (first name is fine) alongside the other details.",
    };
  }

  const whenLabel = formatInTimeZone(new Date(startIso), tz, "EEE d MMM, h:mm a");
  return {
    tag: "create",
    customerName,
    customerPhone: phoneRaw,
    serviceId: svc.id,
    startTimeIso: startIso,
    summaryForReply: `${customerName} — ${svc.displayName} — ${whenLabel}`,
  };
}
