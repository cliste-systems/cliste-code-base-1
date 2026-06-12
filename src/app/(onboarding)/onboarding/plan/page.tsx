import { redirect } from "next/navigation";

import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { PLANS, isPlanTier } from "@/lib/cliste-plans";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";

import { finalisePlanCheckout } from "../actions";

import { PlanPicker } from "./plan-picker";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string | string[];
  session_id?: string | string[];
  error?: string | string[];
}>;

export default async function OnboardingPlanPage(props: {
  searchParams?: SearchParams;
}) {
  const session = await requireOnboardingSession();

  const params = (await props.searchParams) ?? {};

  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const checkoutSessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : params.session_id;

  let returnError = false;
  if (status === "return" && checkoutSessionId) {
    try {
      await finalisePlanCheckout(checkoutSessionId);
    } catch (err) {
      console.warn("[onboarding plan] finalise failed", err);
    }
    const refreshed = await requireOnboardingSession();
    if (refreshed.platformSubscriptionId) {
      redirect("/dashboard?welcome=1");
    }
    // Payment didn't stick — fall through and show an error on the picker.
    returnError = true;
  }

  guardOnboardingPage(session, "/onboarding/plan");

  const plans = Object.values(PLANS).map((p) => ({
    tier: p.tier,
    name: p.name,
    tagline: p.tagline,
    monthlyCents: p.monthlyCents,
    annualCents: p.annualCents,
    includedMinutes: p.includedMinutes,
    includedSms: p.includedSms,
    overageRateCents: p.overageRateCents,
    smsOverageRateCents: p.smsOverageRateCents,
    applicationFeeBps: p.applicationFeeBps,
    features: p.features,
    recommended: Boolean(p.recommended),
    selfServe: p.selfServe,
  }));

  return (
    <OnboardingStepShell
      variant="plan"
      compact
      title="Last step — go live"
      description="Pick a plan to put Cara on your number. 14-day free trial, cancel anytime."
    >
      <PlanPicker
        plans={plans}
        defaultPlan={isPlanTier(session.planTier) ? session.planTier : "pro"}
        defaultInterval={session.billingInterval}
        initialError={returnError ? "payment_unconfirmed" : null}
      />
    </OnboardingStepShell>
  );
}
