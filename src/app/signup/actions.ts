"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getRateLimitStatus,
  rateLimitFingerprint,
  recordRateLimitFailure,
} from "@/lib/auth-rate-limit";
import { scoreSignupFraud, shouldRouteToReview } from "@/lib/signup-security";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const MIN_SALON_NAME = 2;
const MAX_SALON_NAME = 120;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

function slugifySalonName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function uniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string> {
  const seed = base || "salon";
  let candidate = seed;
  for (let i = 0; i < 25; i++) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${seed.slice(0, 44)}-${suffix}`;
  }
  return `${seed}-${Date.now().toString(36)}`;
}

/**
 * Self-serve signup. Creates an auth user (with email already confirmed — the
 * real fraud gate is Stripe KYC later in the wizard, not email verification),
 * an organisation in `status='onboarding'`, and a profile linking them. The
 * caller is then signed in and redirected into the onboarding wizard.
 *
 * Rate-limited by IP via the existing auth rate limiter so signup abuse
 * reuses the same throttle surface as login.
 */
export async function startSignup(_: unknown, formData: FormData): Promise<SignupResult> {
  const salonName = String(formData.get("salonName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!salonName || salonName.length < MIN_SALON_NAME || salonName.length > MAX_SALON_NAME) {
    return { ok: false, message: "Enter your salon or business name." };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return {
      ok: false,
      message: `Password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`,
    };
  }

  const h = await headers();
  const ipFp = rateLimitFingerprint(h, "signup-ip");
  const ipStatus = getRateLimitStatus("authenticate", ipFp);
  if (!ipStatus.allowed) {
    return {
      ok: false,
      message: `Too many signups from this network. Try again in ${ipStatus.retryAfterSeconds}s.`,
      retryAfterSeconds: ipStatus.retryAfterSeconds,
    };
  }

  const ua = h.get("user-agent");
  const forwardedFor = h.get("x-forwarded-for") ?? "";
  const signupIp = forwardedFor.split(",")[0]?.trim() || null;
  const fraud = scoreSignupFraud({ email, salonName, signupIp, userAgent: ua });

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Backend unavailable.",
    };
  }

  const baseSlug = slugifySalonName(salonName);
  const slug = await uniqueSlug(admin, baseSlug);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: salonName,
      source: "self_signup",
    },
    app_metadata: {
      cliste_signup_source: "self_serve",
    },
  });

  if (authError || !authData.user?.id) {
    const raw = authError?.message?.toLowerCase() ?? "";
    if (raw.includes("already") || raw.includes("duplicate") || raw.includes("exists")) {
      recordRateLimitFailure("authenticate", ipFp);
      return {
        ok: false,
        message:
          "An account with this email already exists. Log in instead, or use a different email.",
      };
    }
    recordRateLimitFailure("authenticate", ipFp);
    return {
      ok: false,
      message: authError?.message ?? "Could not create account.",
    };
  }

  const userId = authData.user.id;

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: salonName,
      slug,
      tier: "native",
      is_active: false,
      status: "onboarding",
      onboarding_step: 1,
      launch_status: "not_started",
      billing_period_start: new Date().toISOString().slice(0, 10),
      signup_ip: signupIp,
      signup_user_agent: ua ?? null,
    })
    .select("id")
    .single();

  if (orgErr || !orgRow?.id) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    recordRateLimitFailure("authenticate", ipFp);
    return {
      ok: false,
      message: orgErr?.message ?? "Could not create organisation.",
    };
  }
  const orgId = orgRow.id;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    organization_id: orgId,
    role: "admin",
    name: salonName,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("organizations").delete().eq("id", orgId).then(() => undefined);
    return {
      ok: false,
      message: `Profile not created: ${profileErr.message}`,
    };
  }

  const willReview = shouldRouteToReview(fraud.score);
  await admin
    .from("onboarding_applications")
    .insert({
      organization_id: orgId,
      review_status: willReview ? "pending_review" : "auto_approved",
      fraud_score: fraud.score,
      reasons: fraud.reasons,
    })
    .then(() => undefined);

  // Auto sign-in via user-scoped client so the wizard sees the session.
  const userClient = await createClient();
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    // They can still log in manually; don't fail the whole signup.
    console.warn("[signup] post-signup auto sign-in failed", signInErr.message);
  }

  // Swallow unused import — `cookies` is indirectly consumed by createClient().
  void cookies;

  redirect("/onboarding");
}
