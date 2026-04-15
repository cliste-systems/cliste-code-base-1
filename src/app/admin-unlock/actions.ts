"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  clearRateLimit,
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

const ADMIN_GATE_COOKIE = "cliste_admin_gate";

export async function unlockAdminGate(formData: FormData): Promise<void> {
  const h = await headers();
  const fingerprint = rateLimitFingerprint(h, "admin-unlock");
  const before = getRateLimitStatus("admin_unlock", fingerprint);
  if (!before.allowed) {
    console.warn("[security] admin_unlock_rate_limited", {
      retryAfterSeconds: before.retryAfterSeconds,
    });
    redirect("/admin-unlock?error=rate");
  }

  const password = formData.get("password");
  if (typeof password !== "string") {
    recordRateLimitFailure("admin_unlock", fingerprint);
    console.warn("[security] admin_unlock_bad_payload");
    redirect("/admin-unlock?error=1");
  }

  const secret = process.env.CLISTE_ADMIN_SECRET?.trim();
  if (!secret) {
    recordRateLimitFailure("admin_unlock", fingerprint);
    console.warn("[security] admin_unlock_config_missing");
    redirect("/admin-unlock?error=config");
  }
  if (!(await timingSafeEqualUtf8(password, secret))) {
    const afterFailure = recordRateLimitFailure("admin_unlock", fingerprint);
    console.warn("[security] admin_unlock_wrong_password", {
      retryAfterSeconds: afterFailure.retryAfterSeconds,
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
  redirect("/admin");
}
