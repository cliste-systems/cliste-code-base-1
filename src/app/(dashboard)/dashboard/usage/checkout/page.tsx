import Link from "next/link";

import { StripeEmbeddedCheckout } from "@/components/billing/stripe-embedded-checkout";
import { DASHBOARD_PAGE_SHELL_FILL_WHITE } from "@/components/dashboard/dashboard-surface";
import { stripePublishableConfigured } from "@/lib/stripe-publishable";

import { prepareEmbeddedBillingCheckout } from "../../billing/actions";

export const dynamic = "force-dynamic";

export default async function UsageCheckoutPage() {
  if (!stripePublishableConfigured()) {
    return (
      <CheckoutShell>
        <CheckoutError
          message="Stripe publishable key is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment."
        />
      </CheckoutShell>
    );
  }

  const result = await prepareEmbeddedBillingCheckout();

  if (!result.ok) {
    return (
      <CheckoutShell>
        <CheckoutError message={result.message} />
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <StripeEmbeddedCheckout clientSecret={result.clientSecret} />
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Set up billing
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              14-day free trial, then your plan renews monthly. Cancel anytime.
            </p>
          </div>
          <Link
            href="/dashboard/usage"
            className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Back to usage
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}
