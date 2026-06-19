import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { PLANS, PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";

import { PlanPicker } from "@/app/(onboarding)/onboarding/plan/plan-picker";

export const dynamic = "force-dynamic";

export default function DevOnboardingPlanPreviewPage() {
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
        defaultPlan="pro"
        defaultInterval="month"
        previewCheckoutPath="/dev/onboarding/plan/checkout"
      />
    </OnboardingStepShell>
  );
}
