import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";

const E164_RE = /^\+\d{8,16}$/;
export const ANONYMOUS_CALLER_E164 = "+anonymous";

export type BlockedCallerRow = {
  id: string;
  caller_e164: string;
  reason: string | null;
  created_at: string;
};

/** Normalize and validate a number for the blocklist. Rejects +anonymous. */
export function normalizeBlockedCallerE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const e164 = normalizeCustomerPhoneE164(trimmed);
  if (e164 === ANONYMOUS_CALLER_E164) return null;
  if (!E164_RE.test(e164)) return null;
  return e164;
}

export function isAnonymousCallerE164(callerE164: string): boolean {
  return callerE164.trim() === ANONYMOUS_CALLER_E164;
}

export function isCallerBlocked(input: {
  callerE164: string;
  blockAnonymous: boolean;
  blockedNumbers: ReadonlySet<string> | readonly string[];
}): boolean {
  const caller = input.callerE164.trim();
  if (isAnonymousCallerE164(caller)) {
    return input.blockAnonymous;
  }
  const blocked =
    input.blockedNumbers instanceof Set
      ? input.blockedNumbers
      : new Set(input.blockedNumbers);
  return blocked.has(caller);
}

function phoneDigitsKey(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

/** Prevent owners from blocking their own Cliste line, transfer number, or assigned DIDs. */
export function isOrgProtectedPhone(input: {
  callerE164: string;
  orgPhone?: string | null;
  transferPhone?: string | null;
  assignedDids?: readonly string[];
}): boolean {
  const candidateKey = phoneDigitsKey(input.callerE164);
  if (!candidateKey) return false;

  const protectedRaw = [
    input.orgPhone,
    input.transferPhone,
    ...(input.assignedDids ?? []),
  ].filter((v): v is string => Boolean(v?.trim()));

  for (const raw of protectedRaw) {
    const normalized = normalizeBlockedCallerE164(raw) ?? normalizeCustomerPhoneE164(raw);
    const key = phoneDigitsKey(normalized);
    if (key && key === candidateKey) return true;
  }
  return false;
}

/** Side effects to skip when a call was blocked before Cara started. */
export function shouldRunCallCompleteSideEffects(outcome: string): boolean {
  return outcome !== "blocked";
}
