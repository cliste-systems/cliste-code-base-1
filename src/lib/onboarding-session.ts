import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

/** Bump organisations.onboarding_step when a step completes. */
export const ONBOARDING_STEPS = {
  profile: 1,
  payments: 2,
  plan: 3,
  phone: 4,
  done: 5,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;

export type OnboardingSession = {
  user: User;
  organizationId: string;
  status: string;
  onboardingStep: number;
  planTier: string;
  launchTier: string | null;
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
      "id, status, onboarding_step, plan_tier, launch_tier, launch_status, phone_number, platform_subscription_id, stripe_account_id, stripe_charges_enabled, application_fee_bps",
    )
    .eq("id", profile.organization_id)
    .maybeSingle();

  if (!org) {
    redirect("/authenticate?error=no_org");
  }

  if (org.status === "active") {
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
    launchStatus: (org.launch_status as string) ?? "not_started",
    phoneNumber: (org.phone_number as string | null) ?? null,
    platformSubscriptionId: (org.platform_subscription_id as string | null) ?? null,
    stripeAccountId: (org.stripe_account_id as string | null) ?? null,
    stripeChargesEnabled: Boolean(org.stripe_charges_enabled),
    applicationFeeBps: (org.application_fee_bps as number | null) ?? 100,
  };
}

export function resolveCurrentStepPath(session: OnboardingSession): string {
  // Step 1 must always run first (name was captured at signup but address /
  // niche are still blank). Then payments, then plan, then phone, then done.
  if (session.onboardingStep <= ONBOARDING_STEPS.profile) return "/onboarding/profile";
  if (!session.stripeAccountId || !session.stripeChargesEnabled)
    return "/onboarding/payments";
  if (!session.platformSubscriptionId) return "/onboarding/plan";
  if (!session.phoneNumber) return "/onboarding/phone";
  return "/onboarding/done";
}
