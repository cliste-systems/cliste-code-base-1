"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useState } from "react";

import {
  ClisteCheckoutSubmitButton,
  type CheckoutSubmitPhase,
} from "@/components/billing/cliste-checkout-submit-button";
import {
  ONBOARDING_FIELD_BOX,
  ONBOARDING_FIELD_LABEL,
  ONBOARDING_SELECTION_CARD,
} from "@/components/onboarding/onboarding-ui";
import type { PlatformElementsCheckoutSummary } from "@/lib/platform-billing-elements";
import {
  CLISTE_STRIPE_APPEARANCE,
  CLISTE_STRIPE_FONTS,
} from "@/lib/stripe-elements-theme";
import { getStripeJs } from "@/lib/stripe-publishable";
import { cn } from "@/lib/utils";

const SUCCESS_HOLD_MS = 900;

type Props = {
  clientSecret: string;
  subscriptionId: string;
  summary: PlatformElementsCheckoutSummary;
  returnUrl: string;
  onPersist?: (subscriptionId: string) => Promise<void>;
  onActivated: () => void;
};

export function ClisteStripeCheckoutForm({
  clientSecret,
  subscriptionId,
  summary,
  returnUrl,
  onPersist,
  onActivated,
}: Props) {
  return (
    <Elements
      stripe={getStripeJs()}
      options={{
        clientSecret,
        appearance: CLISTE_STRIPE_APPEARANCE,
        fonts: CLISTE_STRIPE_FONTS,
      }}
    >
      <CheckoutFormInner
        subscriptionId={subscriptionId}
        summary={summary}
        returnUrl={returnUrl}
        onPersist={onPersist}
        onActivated={onActivated}
      />
    </Elements>
  );
}

function CheckoutFormInner({
  subscriptionId,
  summary,
  returnUrl,
  onPersist,
  onActivated,
}: Omit<Props, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitPhase, setSubmitPhase] = useState<CheckoutSubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submitPhase !== "idle") return;

    setSubmitPhase("loading");
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Check your payment details.");
      setSubmitPhase("idle");
      return;
    }

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be confirmed.");
      setSubmitPhase("idle");
      return;
    }

    try {
      await onPersist?.(subscriptionId);
      setSubmitPhase("success");
      window.setTimeout(() => {
        onActivated();
      }, SUCCESS_HOLD_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish checkout.");
      setSubmitPhase("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <CheckoutPlanSummary summary={summary} />

      <div className={cn(ONBOARDING_FIELD_BOX, "px-5 py-4 sm:px-6")}>
        <p className={ONBOARDING_FIELD_LABEL}>Payment method</p>
        <div className="cliste-stripe-payment-element mt-3">
          <PaymentElement
            options={{
              layout: {
                type: "tabs",
                defaultCollapsed: false,
              },
              wallets: {
                applePay: "never",
                googlePay: "never",
                link: "never",
              },
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-center text-[12px] text-red-700">
          {error}
        </p>
      ) : null}

      <ClisteCheckoutSubmitButton
        phase={submitPhase}
        trialDays={summary.trialDays}
        disabled={!stripe || !elements}
      />

      <p className="text-center text-[11px] leading-snug text-slate-400">
        No charge until your trial ends. Cancel anytime in Settings.
      </p>
    </form>
  );
}

function CheckoutPlanSummary({
  summary,
}: {
  summary: PlatformElementsCheckoutSummary;
}) {
  return (
    <div className={cn(ONBOARDING_SELECTION_CARD, "px-5 py-4 sm:px-6")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={ONBOARDING_FIELD_LABEL}>Your plan</p>
          <p className="mt-1.5 text-[1.125rem] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[1.25rem]">
            {summary.planName}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-slate-500">
            {summary.amountLabel}/{summary.intervalLabel} after your trial
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-medium leading-none text-[#0b1220]">
          {summary.trialDays} days free
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
        <p className={ONBOARDING_FIELD_LABEL}>Billing email</p>
        <p
          className="mt-1 truncate text-[14px] font-medium text-[#0b1220]"
          title={summary.email}
        >
          {summary.email}
        </p>
      </div>
    </div>
  );
}
