import type { SupabaseClient } from "@supabase/supabase-js";

const OTP_SENDS_PER_PHONE_PER_HOUR = 5;
const OTP_SENDS_PER_IP_PER_HOUR = 40;
const BOOKING_SUBMITS_PER_IP_PER_15MIN = 25;
const DEFAULT_BOOKINGS_PER_PHONE_PER_DAY = 4;

/**
 * Per-phone daily booking cap. Override via env (e.g. set very high while
 * testing the public booking flow against your own number). Setting it to
 * 0 disables the check entirely — only do that on staging.
 */
function bookingsPerPhonePerDay(): number {
  const raw = process.env.CLISTE_BOOKINGS_PER_PHONE_PER_DAY?.trim();
  if (!raw) return DEFAULT_BOOKINGS_PER_PHONE_PER_DAY;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_BOOKINGS_PER_PHONE_PER_DAY;
  }
  return parsed;
}

/**
 * Comma-separated list of E.164 numbers that bypass the per-phone daily cap
 * (e.g. founder phone for QA). Stripping spaces and the leading "+" so
 * matching is forgiving.
 */
function bypassPhoneSet(): Set<string> {
  const raw = process.env.CLISTE_PUBLIC_BOOKING_BYPASS_PHONES?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().replace(/^\+/, ""))
      .filter(Boolean),
  );
}

export async function recordPublicBookingRateEvent(
  admin: SupabaseClient,
  input: {
    kind: string;
    organizationId: string;
    ipHash: string;
    phoneE164?: string | null;
  },
): Promise<void> {
  await admin.from("public_booking_rate_events").insert({
    kind: input.kind,
    organization_id: input.organizationId,
    ip_hash: input.ipHash,
    phone_e164: input.phoneE164 ?? null,
  });
}

export async function assertOtpSendRateAllowed(
  admin: SupabaseClient,
  organizationId: string,
  phoneE164: string,
  ipHash: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: ipCount, error: ipErr } = await admin
    .from("public_booking_rate_events")
    .select("*", { count: "exact", head: true })
    .eq("kind", "otp_request")
    .eq("ip_hash", ipHash)
    .gte("created_at", hourAgo);

  if (ipErr) {
    return { ok: false, message: "Please try again in a moment." };
  }
  if ((ipCount ?? 0) >= OTP_SENDS_PER_IP_PER_HOUR) {
    return {
      ok: false,
      message: "Too many verification requests. Try again in an hour.",
    };
  }

  const { count: otpChallengeCount, error: otpErr } = await admin
    .from("public_booking_otp_challenges")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("phone_e164", phoneE164)
    .gte("created_at", hourAgo);

  if (otpErr) {
    return { ok: false, message: "Please try again in a moment." };
  }

  /** Twilio Verify path records `otp_request` only on rate_events (no DB challenge row). */
  const { count: otpEventCount, error: otpEvErr } = await admin
    .from("public_booking_rate_events")
    .select("*", { count: "exact", head: true })
    .eq("kind", "otp_request")
    .eq("organization_id", organizationId)
    .eq("phone_e164", phoneE164)
    .gte("created_at", hourAgo);

  if (otpEvErr) {
    return { ok: false, message: "Please try again in a moment." };
  }

  const phoneOtpStarts = Math.max(
    otpChallengeCount ?? 0,
    otpEventCount ?? 0,
  );
  if (phoneOtpStarts >= OTP_SENDS_PER_PHONE_PER_HOUR) {
    return {
      ok: false,
      message: "Too many codes sent to this number. Try again later.",
    };
  }

  return { ok: true };
}

export async function assertBookingSubmitRateAllowed(
  admin: SupabaseClient,
  organizationId: string,
  ipHash: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("public_booking_rate_events")
    .select("*", { count: "exact", head: true })
    .eq("kind", "booking_submit")
    .eq("organization_id", organizationId)
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if (error) {
    return { ok: false, message: "Please try again in a moment." };
  }
  if ((count ?? 0) >= BOOKING_SUBMITS_PER_IP_PER_15MIN) {
    return {
      ok: false,
      message: "Too many booking attempts. Please wait a few minutes.",
    };
  }

  return { ok: true };
}

export async function assertPhoneBookingsPerDayAllowed(
  admin: SupabaseClient,
  organizationId: string,
  phoneE164: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cap = bookingsPerPhonePerDay();
  if (cap === 0) {
    return { ok: true };
  }

  const bypass = bypassPhoneSet();
  if (bypass.has(phoneE164.replace(/^\+/, ""))) {
    return { ok: true };
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("customer_phone", phoneE164)
    .eq("status", "confirmed")
    .gte("created_at", dayAgo);

  if (error) {
    return { ok: false, message: "Please try again in a moment." };
  }
  if ((count ?? 0) >= cap) {
    return {
      ok: false,
      message:
        "This number already has several bookings today. Call the salon if you need more.",
    };
  }

  return { ok: true };
}

export async function hasDuplicateBookingStart(
  admin: SupabaseClient,
  organizationId: string,
  phoneE164: string,
  startIso: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("appointments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_phone", phoneE164)
    .eq("start_time", startIso)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}
