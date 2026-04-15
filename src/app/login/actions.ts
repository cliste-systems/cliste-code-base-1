"use server";

import { cookies, headers } from "next/headers";

import {
  clearRateLimit,
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { verifyTurnstileToken } from "@/lib/public-booking-security";
import { SUPPORT_DASHBOARD_COOKIE } from "@/lib/support-dashboard-cookie";
import { createClient } from "@/utils/supabase/server";

/** Normal password sign-in is the salon user, not platform support — drop the support label. */
export async function clearSupportDashboardCookie() {
  (await cookies()).delete(SUPPORT_DASHBOARD_COOKIE);
}

export type PasswordSignInResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      requiresCaptcha: boolean;
      retryAfterSeconds?: number;
    };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function genericAuthFailureMessage(retryAfterSeconds?: number): string {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return `Too many attempts. Try again in ${retryAfterSeconds}s.`;
  }
  return "Invalid email or password.";
}

export async function passwordSignIn(payload: {
  email: string;
  password: string;
  turnstileToken?: string | null;
}): Promise<PasswordSignInResult> {
  const email = normalizeEmail(String(payload.email ?? ""));
  const password = String(payload.password ?? "");
  if (!email || !password) {
    return {
      ok: false,
      message: "Email and password are required.",
      requiresCaptcha: false,
    };
  }

  const h = await headers();
  const turnstileEnabled = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
  const ipFingerprint = rateLimitFingerprint(h, "auth-ip");
  const emailFingerprint = rateLimitFingerprint(h, `auth-email:${email}`);
  const ipStatus = getRateLimitStatus("authenticate", ipFingerprint);
  const emailStatus = getRateLimitStatus("authenticate", emailFingerprint);
  const preRequiresCaptcha =
    ipStatus.requiresCaptcha || emailStatus.requiresCaptcha;

  if (!ipStatus.allowed || !emailStatus.allowed) {
    const retryAfterSeconds = Math.max(
      ipStatus.retryAfterSeconds,
      emailStatus.retryAfterSeconds
    );
    console.warn("[security] auth_rate_limited", {
      email,
      retryAfterSeconds,
    });
    return {
      ok: false,
      message: genericAuthFailureMessage(retryAfterSeconds),
      requiresCaptcha: turnstileEnabled,
      retryAfterSeconds,
    };
  }

  if (preRequiresCaptcha && turnstileEnabled) {
    const ts = await verifyTurnstileToken(payload.turnstileToken);
    if (!ts.ok) {
      return {
        ok: false,
        message: ts.message,
        requiresCaptcha: true,
      };
    }
  }

  const supabase = await createClient();
  const { error: signError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signError) {
    const afterIp = recordRateLimitFailure("authenticate", ipFingerprint);
    const afterEmail = recordRateLimitFailure("authenticate", emailFingerprint);
    const retryAfterSeconds = Math.max(
      afterIp.retryAfterSeconds,
      afterEmail.retryAfterSeconds
    );
    const requiresCaptcha =
      turnstileEnabled &&
      (afterIp.requiresCaptcha || afterEmail.requiresCaptcha);
    console.warn("[security] auth_sign_in_failed", {
      email,
      reason: signError.message,
      retryAfterSeconds,
      requiresCaptcha,
    });
    return {
      ok: false,
      message: genericAuthFailureMessage(retryAfterSeconds),
      requiresCaptcha,
      retryAfterSeconds: retryAfterSeconds || undefined,
    };
  }

  clearRateLimit("authenticate", ipFingerprint);
  clearRateLimit("authenticate", emailFingerprint);
  (await cookies()).delete(SUPPORT_DASHBOARD_COOKIE);
  console.info("[security] auth_sign_in_success", { email });
  return { ok: true };
}
