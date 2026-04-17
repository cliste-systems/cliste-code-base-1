import { redirect } from "next/navigation";

import { requireOnboardingSession } from "@/lib/onboarding-session";

import {
  startStripeConnectFromOnboarding,
  syncConnectAfterReturn,
} from "../actions";
import { WizardStepper } from "../wizard-stepper";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string | string[]; refresh?: string | string[] }>;

export default async function OnboardingPaymentsPage(props: { searchParams?: SearchParams }) {
  const session = await requireOnboardingSession();
  const params = (await props.searchParams) ?? {};

  const statusValue = Array.isArray(params.status) ? params.status[0] : params.status;
  if (statusValue === "return") {
    await syncConnectAfterReturn();
    const refreshed = await requireOnboardingSession();
    if (refreshed.stripeChargesEnabled) {
      redirect("/onboarding/plan");
    }
  }

  const hasAccount = Boolean(session.stripeAccountId);
  const chargesOk = session.stripeChargesEnabled;

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper current="payments" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Connect your Stripe account
        </h1>
        <p className="max-w-prose text-sm text-gray-600">
          Cliste never holds your clients' money. We create a Stripe Connect
          Express account in your name — payouts land in your bank, directly
          from Stripe. We take a small platform fee (see plan comparison next)
          on each booking.
        </p>
      </header>

      {chargesOk ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Stripe is connected. Redirecting you to plan selection…
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ol className="mb-5 list-decimal space-y-1 pl-4 text-sm text-gray-700">
            <li>You'll be handed over to Stripe to verify your identity (IBAN, ID, VAT if applicable).</li>
            <li>When Stripe confirms, you'll land back here automatically.</li>
            <li>We'll never see your full bank or ID details — just whether charges are enabled.</li>
          </ol>

          <form action={startStripeConnectFromOnboarding}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
            >
              {hasAccount
                ? "Continue Stripe verification"
                : "Connect Stripe"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
