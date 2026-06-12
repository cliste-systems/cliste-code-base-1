"use server";

import { headers } from "next/headers";

import {
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { sendSignupConfirmationEmail } from "@/lib/signup-confirmation-email";

export type ResendConfirmationResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function resendSignupConfirmationEmail(
  emailRaw: string,
): Promise<ResendConfirmationResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const h = await headers();
  const fp = rateLimitFingerprint(h, `signup-resend:${email}`);
  const status = await getRateLimitStatus("authenticate", fp);
  if (!status.allowed) {
    return {
      ok: false,
      message: `Please wait ${status.retryAfterSeconds}s before requesting another email.`,
      retryAfterSeconds: status.retryAfterSeconds,
    };
  }

  const sent = await sendSignupConfirmationEmail({ email });
  if (!sent.ok) {
    const lower = sent.message.toLowerCase();
    if (
      lower.includes("user not found") ||
      lower.includes("not found") ||
      lower.includes("no user")
    ) {
      return { ok: true };
    }
    await recordRateLimitFailure("authenticate", fp);
    return sent;
  }

  return { ok: true };
}
