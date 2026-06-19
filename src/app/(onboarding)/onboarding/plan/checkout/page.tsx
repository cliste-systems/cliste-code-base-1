import { PlanCheckoutFlow } from "@/components/billing/plan-checkout-flow";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { PLATFORM_TRIAL_DAYS } from "@/lib/cliste-plans";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { stripePublishableConfigured } from "@/lib/stripe-publishable";

import {
  persistOnboardingElementsCheckout,
  prepareOnboardingElementsCheckout,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPlanCheckoutPage() {
  const session = await requireOnboardingSession();
  guardOnboardingPage(session, "/onboarding/plan");

  if (!stripePublishableConfigured()) {
    return (
      <OnboardingStepShell
        variant="wide"
        title="Set up billing"
        description={`Add a payment method to start your ${PLATFORM_TRIAL_DAYS}-day free trial.`}
      >
        <CheckoutError
          message="Stripe publishable key is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment."
        />
      </OnboardingStepShell>
    );
  }

  const result = await prepareOnboardingElementsCheckout();

  if (!result.ok) {
    return (
      <OnboardingStepShell
        variant="wide"
        title="Set up billing"
        description={`Add a payment method to start your ${PLATFORM_TRIAL_DAYS}-day free trial.`}
      >
        <CheckoutError message={result.message} />
      </OnboardingStepShell>
    );
  }

  return (
    <PlanCheckoutFlow
      clientSecret={result.clientSecret}
      subscriptionId={result.subscriptionId}
      summary={result.summary}
      returnUrl={result.returnUrl}
      continueHref="/dashboard?welcome=1"
      onPersist={persistOnboardingElementsCheckout}
    />
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}
