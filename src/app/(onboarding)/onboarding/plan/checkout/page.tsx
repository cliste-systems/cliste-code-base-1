import Link from "next/link";

import { StripeEmbeddedCheckout } from "@/components/billing/stripe-embedded-checkout";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { stripePublishableConfigured } from "@/lib/stripe-publishable";

import { prepareOnboardingEmbeddedCheckout } from "../../actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPlanCheckoutPage() {
  const session = await requireOnboardingSession();
  guardOnboardingPage(session, "/onboarding/plan");

  if (!stripePublishableConfigured()) {
    return (
      <OnboardingStepShell
        variant="wide"
        title="Set up billing"
        description="Add a payment method to start your 14-day free trial."
      >
        <CheckoutError
          message="Stripe publishable key is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment."
        />
      </OnboardingStepShell>
    );
  }

  const result = await prepareOnboardingEmbeddedCheckout();

  if (!result.ok) {
    return (
      <OnboardingStepShell
        variant="wide"
        title="Set up billing"
        description="Add a payment method to start your 14-day free trial."
      >
        <CheckoutError message={result.message} />
        <Link
          href="/onboarding/plan"
          className="mt-4 inline-block text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Back to plans
        </Link>
      </OnboardingStepShell>
    );
  }

  return (
    <OnboardingStepShell
      variant="wide"
      title="Set up billing"
      description="14-day free trial, then your plan renews monthly. Cancel anytime."
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex justify-end">
          <Link
            href="/onboarding/plan"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Back to plans
          </Link>
        </div>
        <StripeEmbeddedCheckout clientSecret={result.clientSecret} />
      </div>
    </OnboardingStepShell>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}
