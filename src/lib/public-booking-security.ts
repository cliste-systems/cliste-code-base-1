import { createHash } from "crypto";

import {
  addDaysToYmd,
  getSalonTimeZone,
  todayYmdInTimeZone,
} from "@/lib/booking-available-slots";
import { formatInTimeZone } from "date-fns-tz";

/** Minimum time between "now" and appointment start (anti last-second spam). */
export const PUBLIC_BOOKING_MIN_LEAD_MS = 45 * 60 * 1000;

/** Must match slot prefetch window on the storefront. */
export const PUBLIC_BOOKING_MAX_DAYS_AHEAD = 28;

const REPEAT_DIGIT_RE = /^(\d)\1{9,14}$/;

export function hashIpForRateLimit(ip: string): string {
  const salt = process.env.BOOKING_RATE_LIMIT_SALT?.trim() || "booking-rate-dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Reject obvious garbage after E.164 normalization. */
export function isSuspiciousPhonePattern(phoneE164: string): boolean {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return true;
  if (REPEAT_DIGIT_RE.test(digits)) return true;
  return false;
}

/**
 * Verify Cloudflare Turnstile token (server).
 *
 * Turnstile is enforced only when **both** `TURNSTILE_SECRET_KEY` and
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set. In **production** we additionally
 * require both to be present — silently skipping bot challenge when env
 * vars are misconfigured opens an unsupervised public booking endpoint to
 * scripted abuse (toll/SMS pumping, slot squatting). In dev we still allow
 * skipping so local development isn't blocked by Turnstile setup.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const turnstileEnabled = Boolean(secret && siteKey);

  if (!turnstileEnabled) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed in prod: refuse the booking rather than silently
      // bypassing the bot challenge. Surface a generic message — never
      // leak that Turnstile is misconfigured.
      console.error(
        "[turnstile] production request but TURNSTILE_SECRET_KEY / NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured — refusing.",
      );
      return {
        ok: false,
        message: "Booking is temporarily unavailable. Please try again shortly.",
      };
    }
    return { ok: true };
  }

  const t = token?.trim();
  if (!t) {
    return { ok: false, message: "Please complete the security check." };
  }
  const secretKey = secret!;
  try {
    const body = new URLSearchParams();
    body.set("secret", secretKey);
    body.set("response", t);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success === true) return { ok: true };
    return {
      ok: false,
      message: "Security check failed. Please try again.",
    };
  } catch {
    return { ok: false, message: "Could not verify security check." };
  }
}

export function assertBookingStartTimeAllowed(
  start: Date,
): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  if (start.getTime() < now + PUBLIC_BOOKING_MIN_LEAD_MS) {
    return {
      ok: false,
      message: `Please choose a time at least ${PUBLIC_BOOKING_MIN_LEAD_MS / 60000} minutes from now.`,
    };
  }

  const tz = getSalonTimeZone();
  const lastYmd = addDaysToYmd(
    todayYmdInTimeZone(tz),
    PUBLIC_BOOKING_MAX_DAYS_AHEAD,
    tz,
  );
  const startYmd = formatInTimeZone(start, tz, "yyyy-MM-dd");
  if (startYmd > lastYmd) {
    return {
      ok: false,
      message: `Bookings are only available up to ${PUBLIC_BOOKING_MAX_DAYS_AHEAD} days ahead.`,
    };
  }
  return { ok: true };
}

/**
 * Local-dev escape hatch to skip phone OTP verification on public bookings.
 *
 * Hard refuse in production: if this env var is left on by accident in a
 * prod deploy, the public booking endpoint stops requiring SMS OTP and a
 * scripted client can spam confirmed bookings under any made-up number.
 * Better to crash loud at startup than silently serve a no-OTP endpoint.
 */
export function isOtpBypassEnabled(): boolean {
  const enabled = process.env.PUBLIC_BOOKING_OTP_DISABLED?.trim() === "true";
  if (enabled && process.env.NODE_ENV === "production") {
    console.error(
      "[public-booking] PUBLIC_BOOKING_OTP_DISABLED=true is forbidden in production — ignoring.",
    );
    return false;
  }
  return enabled;
}
