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
import { ArrowLeft, Lock } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Second step of the public booking dialog: customer fills their card details
 * using Stripe's hosted Payment Element (PCI-safe — the card never touches our
 * server). We call `stripe.confirmPayment` with a `return_url` that points at
 * our own success page so the UX stays on the salon's branded storefront even
 * when 3-D Secure forces a redirect.
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
      colorDanger: "#dc2626",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      borderRadius: "10px",
      spacingUnit: "4px",
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

    // Build an absolute return URL for Stripe's redirect flow (3DS, some
    // wallets). Falls back to a sensible default in SSR but this only runs on
    // the client.
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const returnUrl = `${origin}${returnPath}`;

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      // Stay on-page when no redirect is needed (typical card, no 3DS).
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment could not be completed.");
      setPending(false);
      return;
    }

    // No-redirect success: navigate ourselves to the booking success page.
    if (
      paymentIntent &&
      (paymentIntent.status === "succeeded" ||
        paymentIntent.status === "processing" ||
        paymentIntent.status === "requires_capture")
    ) {
      window.location.assign(returnUrl);
      return;
    }

    // Shouldn't reach here normally; keep the button re-clickable.
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-medium text-gray-900">{serviceName}</div>
          <div className="font-semibold text-gray-900">{amountLabel}</div>
        </div>
        <div className="mt-0.5 text-[12px] text-gray-500">
          {salonName} · {timeLabel}
        </div>
        <div className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">
          Booking #{bookingReference}
        </div>
      </div>

      <PaymentElement options={{ layout: "tabs" }} />

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
        <Lock className="h-3 w-3" aria-hidden />
        Payments are processed securely by Stripe. Card details never touch our
        servers.
      </div>

      <div className="flex items-center gap-2">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={pending}
          >
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
            Back
          </Button>
        ) : null}
        <Button type="submit" className="flex-1" disabled={pending || !stripe}>
          {pending ? "Processing…" : `Pay ${amountLabel}`}
        </Button>
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
