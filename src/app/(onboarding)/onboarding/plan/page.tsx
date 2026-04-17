import { redirect } from "next/navigation";

import { LAUNCHES, PLANS, isLaunchTier, isPlanTier } from "@/lib/cliste-plans";
import { requireOnboardingSession } from "@/lib/onboarding-session";

import { finalisePlanCheckout } from "../actions";
import { WizardStepper } from "../wizard-stepper";

import { PlanPicker } from "./plan-picker";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string | string[];
  session_id?: string | string[];
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

  if (status === "return" && checkoutSessionId) {
    try {
      await finalisePlanCheckout(checkoutSessionId);
    } catch (err) {
      console.warn("[onboarding plan] finalise failed", err);
    }
    const refreshed = await requireOnboardingSession();
    if (refreshed.platformSubscriptionId) {
      redirect("/onboarding/phone");
    }
  }

  const plans = Object.values(PLANS).map((p) => ({
    tier: p.tier,
    name: p.name,
    tagline: p.tagline,
    monthlyCents: p.monthlyCents,
    annualCents: p.annualCents,
    includedMinutes: p.includedMinutes,
    overageRateCents: p.overageRateCents,
    applicationFeeBps: p.applicationFeeBps,
    features: p.features,
    recommended: Boolean(p.recommended),
  }));

  const launches = Object.values(LAUNCHES).map((l) => ({
    tier: l.tier,
    name: l.name,
    description: l.description,
    priceCents: l.priceCents,
    targetRegion: l.targetRegion,
  }));

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper current="plan" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Pick your plan + launch
        </h1>
        <p className="max-w-prose text-sm text-gray-600">
          Plans compared below. Annual billing saves you two months. Setup is
          optional — most salons pick Remote Launch for an hour with a
          specialist, or DIY if you&apos;re comfortable with the self-serve flow.
        </p>
      </header>

      <PlanPicker
        plans={plans}
        launches={launches}
        defaultPlan={isPlanTier(session.planTier) ? session.planTier : "pro"}
        defaultLaunch={
          isLaunchTier(session.launchTier ?? "")
            ? (session.launchTier as (typeof launches)[number]["tier"])
            : "remote"
        }
      />
    </div>
  );
}
