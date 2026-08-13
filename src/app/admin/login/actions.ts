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
  ADMIN_GATE_COOKIE_PREFIX,
  createGateCookieValue,
  DEFAULT_GATE_TTL_SECONDS,
} from "@/lib/gate-cookie";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { ADMIN_LOGIN_PATH } from "@/lib/staff-route-paths";
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

export async function submitAdminLogin(formData: FormData): Promise<void> {
  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const fingerprint = rateLimitFingerprint(h, "admin-login");
  const before = await getRateLimitStatus("admin_login", fingerprint);
  if (!before.allowed) {
    console.warn("[security] admin_login_rate_limited", {
      retryAfterSeconds: before.retryAfterSeconds,
    });
    await logSecurityEvent(securityCtx, {
      eventType: "admin_login",
      outcome: "rate_limited",
      attemptCount: before.failuresInWindow,
      metadata: { retryAfterSeconds: before.retryAfterSeconds },
    });
    redirect(`${ADMIN_LOGIN_PATH}?error=rate`);
  }

  const password = formData.get("password");
  if (typeof password !== "string") {
    await recordRateLimitFailure("admin_login", fingerprint);
    console.warn("[security] admin_login_bad_payload");
    await logSecurityEvent(securityCtx, {
      eventType: "admin_login",
      outcome: "failure",
      metadata: { reason: "bad_payload" },
    });
    redirect(`${ADMIN_LOGIN_PATH}?error=1`);
  }

  const secret = process.env.CLISTE_ADMIN_SECRET?.trim();
  if (!secret) {
    await recordRateLimitFailure("admin_login", fingerprint);
    console.warn("[security] admin_login_config_missing");
    await logSecurityEvent(securityCtx, {
      eventType: "admin_login",
      outcome: "config_error",
      metadata: { reason: "missing_secret" },
    });
    redirect(`${ADMIN_LOGIN_PATH}?error=config`);
  }
  if (!(await timingSafeEqualUtf8(password, secret))) {
    const afterFailure = await recordRateLimitFailure("admin_login", fingerprint);
    console.warn("[security] admin_login_wrong_password", {
      retryAfterSeconds: afterFailure.retryAfterSeconds,
    });
    await logSecurityEvent(securityCtx, {
      eventType: "admin_login",
      outcome: afterFailure.allowed ? "failure" : "rate_limited",
      attemptCount: afterFailure.failuresInWindow,
      metadata: { retryAfterSeconds: afterFailure.retryAfterSeconds },
    });
    if (!afterFailure.allowed) {
      redirect(`${ADMIN_LOGIN_PATH}?error=rate`);
    }
    redirect(`${ADMIN_LOGIN_PATH}?error=1`);
  }

  await clearRateLimit("admin_login", fingerprint);
  const cookieValue = await createGateCookieValue(
    ADMIN_GATE_COOKIE_PREFIX,
    secret,
    DEFAULT_GATE_TTL_SECONDS
  );
  (await cookies()).set(ADMIN_GATE_COOKIE, cookieValue, {
    httpOnly: true,
    path: "/",
    maxAge: DEFAULT_GATE_TTL_SECONDS,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  console.info("[security] admin_login_success");
  await logSecurityEvent(securityCtx, {
    eventType: "admin_login",
    outcome: "success",
  });
  redirect("/admin");
}
