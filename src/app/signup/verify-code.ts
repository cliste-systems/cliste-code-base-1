"use server";

import { headers } from "next/headers";

import {
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { createClient } from "@/utils/supabase/server";

export type VerifySignupCodeResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

/**
 * Verifies the 6-digit email code from the signup confirmation email and
 * signs the user in (cookies set via the server client). Rate-limited per
 * IP+email so the 6-digit space cannot be brute-forced.
 */
export async function verifySignupCode(
  emailRaw: string,
  codeRaw: string,
): Promise<VerifySignupCodeResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const code = String(codeRaw ?? "").replace(/\s/g, "");
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!CODE_RE.test(code)) {
    return { ok: false, message: "Enter the 6-digit code from the email." };
  }

  const h = await headers();
  const fp = rateLimitFingerprint(h, `signup-verify:${email}`);
  const status = await getRateLimitStatus("authenticate", fp);
  if (!status.allowed) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${status.retryAfterSeconds}s.`,
      retryAfterSeconds: status.retryAfterSeconds,
    };
  }

  const supabase = await createClient();

  // First signup emails carry a "signup" token; resent emails carry
  // "magiclink". A wrong-type lookup fails without consuming the token,
  // so trying both is safe.
  for (const type of ["signup", "magiclink"] as const) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (!error) {
      return { ok: true };
    }
  }

  await recordRateLimitFailure("authenticate", fp);
  return {
    ok: false,
    message:
      "That code is invalid or has expired. Double-check the latest email, or resend a new code.",
  };
}
