"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  clearRateLimit,
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { SUPPORT_DASHBOARD_COOKIE } from "@/lib/support-dashboard-cookie";

const ADMIN_GATE_COOKIE = "cliste_admin_gate";
const DASHBOARD_GATE_COOKIE = "cliste_dashboard_gate";

export async function clearAdminSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_GATE_COOKIE);
  jar.delete(SUPPORT_DASHBOARD_COOKIE);
  jar.delete(DASHBOARD_GATE_COOKIE);
}

export async function unlockAdminGate(formData: FormData): Promise<void> {
  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const fingerprint = rateLimitFingerprint(h, "admin-unlock");
  const before = getRateLimitStatus("admin_unlock", fingerprint);
  if (!before.allowed) {
    console.warn("[security] admin_unlock_rate_limited", {
      retryAfterSeconds: before.retryAfterSeconds,
    });
    await logSecurityEvent(securityCtx, {
      eventType: "admin_unlock",
      outcome: "rate_limited",
      attemptCount: before.failuresInWindow,
      metadata: { retryAfterSeconds: before.retryAfterSeconds },
    });
    redirect("/admin-unlock?error=rate");
  }

  const password = formData.get("password");
  if (typeof password !== "string") {
    recordRateLimitFailure("admin_unlock", fingerprint);
    console.warn("[security] admin_unlock_bad_payload");
    await logSecurityEvent(securityCtx, {
      eventType: "admin_unlock",
      outcome: "failure",
      metadata: { reason: "bad_payload" },
    });
    redirect("/admin-unlock?error=1");
  }

  const secret = process.env.CLISTE_ADMIN_SECRET?.trim();
  if (!secret) {
    recordRateLimitFailure("admin_unlock", fingerprint);
    console.warn("[security] admin_unlock_config_missing");
    await logSecurityEvent(securityCtx, {
      eventType: "admin_unlock",
      outcome: "config_error",
      metadata: { reason: "missing_secret" },
    });
    redirect("/admin-unlock?error=config");
  }
  if (!(await timingSafeEqualUtf8(password, secret))) {
    const afterFailure = recordRateLimitFailure("admin_unlock", fingerprint);
    console.warn("[security] admin_unlock_wrong_password", {
      retryAfterSeconds: afterFailure.retryAfterSeconds,
    });
    await logSecurityEvent(securityCtx, {
      eventType: "admin_unlock",
      outcome: afterFailure.allowed ? "failure" : "rate_limited",
      attemptCount: afterFailure.failuresInWindow,
      metadata: { retryAfterSeconds: afterFailure.retryAfterSeconds },
    });
    if (!afterFailure.allowed) {
      redirect("/admin-unlock?error=rate");
    }
    redirect("/admin-unlock?error=1");
  }

  clearRateLimit("admin_unlock", fingerprint);
  (await cookies()).set(ADMIN_GATE_COOKIE, secret, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  console.info("[security] admin_unlock_success");
  await logSecurityEvent(securityCtx, {
    eventType: "admin_unlock",
    outcome: "success",
  });
  redirect("/admin");
}
