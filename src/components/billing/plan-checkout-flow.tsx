"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ClisteCheckoutSuccess } from "@/components/billing/cliste-checkout-success";
import { ClisteStripeCheckoutForm } from "@/components/billing/cliste-stripe-checkout-form";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import { PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans.data";
import type { PlatformElementsCheckoutSummary } from "@/lib/platform-billing-elements";

type Props = {
  clientSecret: string;
  subscriptionId: string;
  summary: PlatformElementsCheckoutSummary;
  returnUrl: string;
  continueHref: string;
  continueLabel?: string;
  onPersist?: (subscriptionId: string, setupIntentId?: string) => Promise<void>;
};

export function PlanCheckoutFlow(props: Props) {
  return (
    <Suspense fallback={<PlanCheckoutFlowFallback />}>
      <PlanCheckoutFlowInner {...props} />
    </Suspense>
  );
}

function PlanCheckoutFlowFallback() {
  return (
    <OnboardingStepShell
      variant="checkout"
      centered
      title="Set up billing"
      description={`${PLATFORM_TRIAL_DAYS}-day free trial, then your plan renews monthly. Cancel anytime.`}
    >
      <div className="h-[28rem] w-full" aria-hidden />
    </OnboardingStepShell>
  );
}

function PlanCheckoutFlowInner({
  clientSecret,
  subscriptionId,
  summary,
  returnUrl,
  continueHref,
  continueLabel,
  onPersist,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activated, setActivated] = useState(
    () => searchParams.get("complete") === "1",
  );
  const reduceMotion = useReducedMotion();

  function handleActivated() {
    setActivated(true);
    router.replace(`${pathname}?complete=1`, { scroll: false });
  }

  return (
    <OnboardingStepShell
      variant="checkout"
      centered
      contentOnly={activated}
      hideLogo={activated}
      title={activated ? undefined : "Set up billing"}
      description={
        activated
          ? undefined
          : `${PLATFORM_TRIAL_DAYS}-day free trial, then your plan renews monthly. Cancel anytime.`
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {!activated ? (
          <motion.div
            key="checkout-form"
            className="w-full"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, y: -10, transition: { duration: 0.28, ease: ONBOARDING_EASE } }
            }
          >
            <ClisteStripeCheckoutForm
              clientSecret={clientSecret}
              subscriptionId={subscriptionId}
              summary={summary}
              returnUrl={returnUrl}
              onPersist={onPersist}
              onActivated={handleActivated}
            />
          </motion.div>
        ) : (
          <motion.div
            key="checkout-success"
            className="w-full"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: ONBOARDING_EASE }}
          >
            <ClisteCheckoutSuccess
              trialDays={summary.trialDays}
              continueHref={continueHref}
              continueLabel={continueLabel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </OnboardingStepShell>
  );
}
