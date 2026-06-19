import { redirect } from "next/navigation";

import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { PLANS, isPlanTier, PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";

import { finaliseElementsCheckoutReturn, finalisePlanCheckout } from "../actions";

import { PlanPicker } from "./plan-picker";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string | string[];
  session_id?: string | string[];
  subscription_id?: string | string[];
  setup_intent?: string | string[];
  redirect_status?: string | string[];
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
  const subscriptionId = Array.isArray(params.subscription_id)
    ? params.subscription_id[0]
    : params.subscription_id;
  const setupIntentId = Array.isArray(params.setup_intent)
    ? params.setup_intent[0]
    : params.setup_intent;
  const redirectStatus = Array.isArray(params.redirect_status)
    ? params.redirect_status[0]
    : params.redirect_status;

  let returnError = false;
  if (status === "return") {
    if (checkoutSessionId) {
      try {
        await finalisePlanCheckout(checkoutSessionId);
      } catch (err) {
        console.warn("[onboarding plan] finalise failed", err);
      }
      const refreshed = await requireOnboardingSession();
      if (refreshed.platformSubscriptionId) {
        redirect("/dashboard?welcome=1");
      }
      returnError = true;
    } else if (
      subscriptionId &&
      setupIntentId &&
      redirectStatus === "succeeded"
    ) {
      try {
        await finaliseElementsCheckoutReturn({ subscriptionId, setupIntentId });
        redirect("/dashboard?welcome=1");
      } catch (err) {
        console.warn("[onboarding plan] elements return finalise failed", err);
        returnError = true;
      }
    } else if (redirectStatus === "failed") {
      returnError = true;
    }
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
      description={`Pick a plan to put Cara on your number. ${PLATFORM_TRIAL_DAYS}-day free trial, cancel anytime.`}
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
