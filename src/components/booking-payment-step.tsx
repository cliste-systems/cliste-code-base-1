"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type {
  Appearance,
  Stripe as StripeJs,
  StripeElementsOptions,
} from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Step 2 of the public booking dialog. The customer fills card details (or
 * picks Apple Pay / Google Pay / Link / Revolut Pay / Bancontact / Klarna)
 * via Stripe's hosted Payment Element — the card data never touches our DOM,
 * so we keep PCI SAQ-A scope and inherit Stripe's wallet UX, 3DS, and Radar
 * fraud signals.
 *
 * Visual style is modelled on the modern payment card / sheet pattern (clean
 * white card, prominent total at top, single dark CTA at the bottom). We can
 * not literally swap in `RuixenPaymentCard` from 21st.dev because that is a
 * plain-HTML card form — using it would break PCI compliance and remove every
 * wallet method.
 */
export type BookingPaymentStepProps = {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  currency: string;
  bookingReference: string;
  salonName: string;
  serviceName: string;
  startTimeIso: string;
  /** Relative path (e.g. `/admin-salon/booking/success?ref=ABC123`). */
  returnPath: string;
  /** Called when the user clicks "Back" to pick a different time/service. */
  onBack?: () => void;
};

export function BookingPaymentStep(props: BookingPaymentStepProps) {
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  );

  const appearance: Appearance = {
    theme: "stripe",
    variables: {
      colorPrimary: "#111827",
      colorBackground: "#ffffff",
      colorText: "#111827",
      colorTextSecondary: "#6b7280",
      colorTextPlaceholder: "#9ca3af",
      colorDanger: "#dc2626",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSizeBase: "15px",
      borderRadius: "12px",
      spacingUnit: "4px",
    },
    rules: {
      ".Tab": {
        border: "1px solid #e5e7eb",
        boxShadow: "none",
      },
      ".Tab--selected": {
        borderColor: "#111827",
        boxShadow: "0 0 0 1px #111827",
      },
      ".Input": {
        border: "1px solid #e5e7eb",
        boxShadow: "none",
        padding: "12px 14px",
      },
      ".Input:focus": {
        borderColor: "#111827",
        boxShadow: "0 0 0 1px #111827",
      },
      ".Label": {
        fontWeight: "500",
        color: "#374151",
      },
    },
  };

  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance,
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <InnerPaymentForm {...props} />
    </Elements>
  );
}

function InnerPaymentForm({
  amountCents,
  currency,
  bookingReference,
  salonName,
  serviceName,
  startTimeIso,
  returnPath,
  onBack,
}: BookingPaymentStepProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountLabel = formatMoney(amountCents, currency);

  const timeLabel = useMemo(() => {
    try {
      return new Date(startTimeIso).toLocaleString("en-IE", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return startTimeIso;
    }
  }, [startTimeIso]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPending(true);
    setError(null);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const returnUrl = `${origin}${returnPath}`;

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment could not be completed.");
      setPending(false);
      return;
    }

    if (
      paymentIntent &&
      (paymentIntent.status === "succeeded" ||
        paymentIntent.status === "processing" ||
        paymentIntent.status === "requires_capture")
    ) {
      window.location.assign(returnUrl);
      return;
    }

    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Order summary — stacked total like the modern payment modal pattern */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Total
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-3xl font-semibold tracking-tight text-gray-900">
            {amountLabel}
          </div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">
              {serviceName}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-gray-500">
              {salonName} · {timeLabel}
            </div>
          </div>
          <div className="shrink-0 rounded-md bg-gray-50 px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-gray-500">
            #{bookingReference}
          </div>
        </div>
      </div>

      {/* Payment Element — Stripe owns the card / wallet inputs */}
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* Trust strip + dark Checkout CTA */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" aria-hidden />
            Encrypted by Stripe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Card details never touch our servers
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={pending}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending || !stripe}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Processing…" : `Pay ${amountLabel}`}
          </button>
        </div>
      </div>
    </form>
  );
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
