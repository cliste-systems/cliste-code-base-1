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
  createGateCookieValue,
  DASHBOARD_GATE_COOKIE_PREFIX,
  DEFAULT_GATE_TTL_SECONDS,
} from "@/lib/gate-cookie";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

const DASHBOARD_GATE_COOKIE = "cliste_dashboard_gate";

export async function unlockDashboardPreviewGate(
  formData: FormData
): Promise<void> {
  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const fingerprint = rateLimitFingerprint(h, "dashboard-unlock");
  const before = getRateLimitStatus("dashboard_unlock", fingerprint);
  if (!before.allowed) {
    console.warn("[security] dashboard_unlock_rate_limited", {
      retryAfterSeconds: before.retryAfterSeconds,
    });
    await logSecurityEvent(securityCtx, {
      eventType: "dashboard_unlock",
      outcome: "rate_limited",
      attemptCount: before.failuresInWindow,
      metadata: { retryAfterSeconds: before.retryAfterSeconds },
    });
    redirect("/dashboard-unlock?error=rate");
  }

  const password = formData.get("password");
  if (typeof password !== "string") {
    recordRateLimitFailure("dashboard_unlock", fingerprint);
    await logSecurityEvent(securityCtx, {
      eventType: "dashboard_unlock",
      outcome: "failure",
      metadata: { reason: "bad_payload" },
    });
    redirect("/dashboard-unlock?error=1");
  }

  const secret = process.env.CLISTE_DASHBOARD_GATE_SECRET?.trim();
  if (!secret) {
    recordRateLimitFailure("dashboard_unlock", fingerprint);
    await logSecurityEvent(securityCtx, {
      eventType: "dashboard_unlock",
      outcome: "config_error",
      metadata: { reason: "missing_secret" },
    });
    redirect("/dashboard-unlock?error=config");
  }
  if (!(await timingSafeEqualUtf8(password, secret))) {
    const afterFailure = recordRateLimitFailure(
      "dashboard_unlock",
      fingerprint
    );
    await logSecurityEvent(securityCtx, {
      eventType: "dashboard_unlock",
      outcome: afterFailure.allowed ? "failure" : "rate_limited",
      attemptCount: afterFailure.failuresInWindow,
      metadata: { retryAfterSeconds: afterFailure.retryAfterSeconds },
    });
    if (!afterFailure.allowed) {
      redirect("/dashboard-unlock?error=rate");
    }
    redirect("/dashboard-unlock?error=1");
  }

  clearRateLimit("dashboard_unlock", fingerprint);
  const cookieValue = await createGateCookieValue(
    DASHBOARD_GATE_COOKIE_PREFIX,
    secret,
    DEFAULT_GATE_TTL_SECONDS
  );

  const jar = await cookies();
  jar.set(DASHBOARD_GATE_COOKIE, cookieValue, {
    httpOnly: true,
    path: "/",
    maxAge: DEFAULT_GATE_TTL_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  await logSecurityEvent(securityCtx, {
    eventType: "dashboard_unlock",
    outcome: "success",
  });
  redirect("/dashboard");
}
