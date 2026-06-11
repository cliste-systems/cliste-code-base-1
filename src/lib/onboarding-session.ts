import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { enforceOnboardingStepOrder } from "@/lib/onboarding-dev";
import { createClient } from "@/utils/supabase/server";

/**
 * Bump organisations.onboarding_step when a step completes.
 *
 * Payment is deferred to the end. The wizard runs:
 * profile -> voice -> knowledge -> actions -> number -> test call ->
 * go live (plan + pay) -> dashboard.
 */
export const ONBOARDING_STEPS = {
  profile: 1,
  voice: 2,
  knowledge: 3,
  actions: 4,
  number: 5,
  testCall: 6,
  goLive: 7,
  done: 8,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;

export type OnboardingSession = {
  user: User;
  organizationId: string;
  status: string;
  onboardingStep: number;
  planTier: string;
  launchTier: string | null;
  billingInterval: "month" | "year";
  launchStatus: string;
  phoneNumber: string | null;
  platformSubscriptionId: string | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  applicationFeeBps: number;
};

export async function requireOnboardingSession(): Promise<OnboardingSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/authenticate?next=/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    // Account exists but has no org — stale / corrupted state. Send them back
    // to authenticate where they can re-start or contact support.
    redirect("/authenticate?error=no_org");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, status, onboarding_step, plan_tier, launch_tier, launch_status, phone_number, platform_subscription_id, stripe_account_id, stripe_charges_enabled, application_fee_bps, billing_interval",
    )
    .eq("id", profile.organization_id)
    .maybeSingle();

  if (!org) {
    redirect("/authenticate?error=no_org");
  }

  if (org.status === "active" && enforceOnboardingStepOrder()) {
    redirect("/dashboard");
  }
  if (org.status === "suspended") {
    redirect("/dashboard/billing?suspended=1");
  }

  return {
    user: user!,
    organizationId: org.id as string,
    status: org.status as string,
    onboardingStep: (org.onboarding_step as number) ?? 1,
    planTier: (org.plan_tier as string) ?? "pro",
    launchTier: (org.launch_tier as string | null) ?? null,
    billingInterval: org.billing_interval === "year" ? "year" : "month",
    launchStatus: (org.launch_status as string) ?? "not_started",
    phoneNumber: (org.phone_number as string | null) ?? null,
    platformSubscriptionId: (org.platform_subscription_id as string | null) ?? null,
    stripeAccountId: (org.stripe_account_id as string | null) ?? null,
    stripeChargesEnabled: Boolean(org.stripe_charges_enabled),
    applicationFeeBps: (org.application_fee_bps as number | null) ?? 100,
  };
}

export function resolveCurrentStepPath(session: OnboardingSession): string {
  // Payment deferred: profile -> voice -> knowledge -> actions -> number ->
  // test call -> go live (plan) -> dashboard.
  if (session.onboardingStep <= ONBOARDING_STEPS.profile) return "/onboarding/profile";
  if (session.onboardingStep <= ONBOARDING_STEPS.voice) return "/onboarding/voice";
  if (session.onboardingStep <= ONBOARDING_STEPS.knowledge) return "/onboarding/knowledge";
  if (session.onboardingStep <= ONBOARDING_STEPS.actions) return "/onboarding/actions";
  if (session.onboardingStep <= ONBOARDING_STEPS.number) return "/onboarding/number";
  if (session.onboardingStep <= ONBOARDING_STEPS.testCall) return "/onboarding/test-call";
  if (session.onboardingStep < ONBOARDING_STEPS.done) return "/onboarding/plan";
  return "/dashboard";
}
