import { CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { getApplicationFeeBps, stripeIsConfigured } from "@/lib/stripe";
import { cn } from "@/lib/utils";

import {
  ConnectStripeButton,
  OpenStripeDashboardButton,
} from "./connect-buttons";
import { syncStripeConnectStatus } from "./actions";
import { PaymentRowActions } from "./payment-row-actions";

/** Payments dashboard: operator sees Connect status + recent paid bookings. */
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PaidAppointmentRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  start_time: string;
  amount_cents: number | null;
  currency: string | null;
  platform_fee_cents: number | null;
  payment_status: string | null;
  paid_at: string | null;
  booking_reference: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  services: { name: string | null } | null;
};

export default async function PaymentsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const isReturnFromStripe = sp.status === "return";

  const { supabase, organizationId } = await requireDashboardSession();

  if (isReturnFromStripe) {
    // Best-effort pull fresh capabilities from Stripe so the UI reflects
    // reality even before the webhook lands.
    try {
      await syncStripeConnectStatus();
    } catch (err) {
      console.warn("syncStripeConnectStatus failed", err);
    }
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      [
        "id",
        "name",
        "stripe_account_id",
        "stripe_charges_enabled",
        "stripe_payouts_enabled",
        "stripe_details_submitted",
        "stripe_onboarded_at",
        "application_fee_bps",
        "plan_tier",
      ].join(", "),
    )
    .eq("id", organizationId)
    .maybeSingle<{
      id: string;
      name: string | null;
      stripe_account_id: string | null;
      stripe_charges_enabled: boolean | null;
      stripe_payouts_enabled: boolean | null;
      stripe_details_submitted: boolean | null;
      stripe_onboarded_at: string | null;
      application_fee_bps: number | null;
      plan_tier: string | null;
    }>();

  const stripeOk = stripeIsConfigured();
  const hasAccount = Boolean(org?.stripe_account_id);
  const chargesEnabled = Boolean(org?.stripe_charges_enabled);
  const payoutsEnabled = Boolean(org?.stripe_payouts_enabled);
  const onboardingComplete = chargesEnabled && payoutsEnabled;

  const { data: payments } = await supabase
    .from("appointments")
    .select(
      `id, customer_name, customer_phone, customer_email, start_time, amount_cents, currency, platform_fee_cents, payment_status, paid_at, booking_reference, stripe_payment_intent_id, stripe_charge_id, services ( name )`,
    )
    .eq("organization_id", organizationId)
    .not("payment_status", "is", null)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("start_time", { ascending: false })
    .limit(50)
    .returns<PaidAppointmentRow[]>();

  const rows = payments ?? [];

  const feeBps = getApplicationFeeBps(org?.application_fee_bps);
  const feePct = (feeBps / 100).toFixed(2).replace(/\.00$/, "");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 pb-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CreditCard className="size-5" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Payments
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-gray-500">
          Accept card payments on your booking page via Stripe. Payouts land in
          your Stripe balance and then your connected bank account. Cliste keeps
          a {feePct}% platform fee per paid booking.
        </p>
      </header>

      {!stripeOk ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Stripe is not configured on this deployment yet. Set{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
            STRIPE_SECRET_KEY
          </code>{" "}
          in the environment and redeploy.
        </div>
      ) : null}

      <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold tracking-tight text-gray-900">
              Stripe Connect status
            </h2>
            <p className="text-sm text-gray-500">
              {onboardingComplete
                ? "Ready to accept card payments."
                : hasAccount
                  ? "Onboarding started but not complete. Finish setup on Stripe to start accepting payments."
                  : "Not connected. Connect to start accepting card payments on your bookings."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasAccount ? (
              <>
                <ConnectStripeButton
                  label={onboardingComplete ? "Update details" : "Continue on Stripe"}
                />
                {onboardingComplete ? <OpenStripeDashboardButton /> : null}
              </>
            ) : (
              <ConnectStripeButton />
            )}
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatusCell
            label="Card payments"
            active={chargesEnabled}
            pending={hasAccount && !chargesEnabled}
          />
          <StatusCell
            label="Payouts to bank"
            active={payoutsEnabled}
            pending={hasAccount && !payoutsEnabled}
          />
          <StatusCell
            label="Details submitted"
            active={Boolean(org?.stripe_details_submitted)}
            pending={hasAccount && !org?.stripe_details_submitted}
          />
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-gray-900">
            Recent payments
          </h2>
          <p className="text-xs text-gray-400">Last 50</p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/50 p-8 text-center">
            <p className="text-sm text-gray-500">
              No payments yet. Once a client books and pays, you will see it
              here with your payout amount after the Cliste fee.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3 text-right">Charged</th>
                  <th className="px-4 py-3 text-right">Cliste fee</th>
                  <th className="px-4 py-3 text-right">Your payout</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const charged = formatMoney(
                    row.amount_cents,
                    row.currency ?? "eur",
                  );
                  const fee = formatMoney(
                    row.platform_fee_cents,
                    row.currency ?? "eur",
                  );
                  const payout =
                    row.amount_cents != null && row.platform_fee_cents != null
                      ? formatMoney(
                          row.amount_cents - row.platform_fee_cents,
                          row.currency ?? "eur",
                        )
                      : "—";
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {row.customer_name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(row.start_time).toLocaleString("en-IE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {row.services?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {charged}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {fee}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {payout}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge value={row.payment_status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentRowActions
                          appointmentId={row.id}
                          customerName={row.customer_name}
                          customerEmail={row.customer_email}
                          customerPhone={row.customer_phone}
                          serviceName={row.services?.name ?? null}
                          startTimeIso={row.start_time}
                          amountCents={row.amount_cents}
                          platformFeeCents={row.platform_fee_cents}
                          currency={row.currency}
                          paymentStatus={row.payment_status}
                          paidAtIso={row.paid_at}
                          bookingReference={row.booking_reference}
                          stripePaymentIntentId={row.stripe_payment_intent_id}
                          stripeChargeId={row.stripe_charge_id}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusCell({
  label,
  active,
  pending,
}: {
  label: string;
  active: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
      {active ? (
        <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
      ) : pending ? (
        <Loader2 className="size-4 animate-spin text-amber-600" aria-hidden />
      ) : (
        <ExternalLink className="size-4 text-gray-400" aria-hidden />
      )}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span
          className={cn(
            "text-[11px]",
            active
              ? "text-emerald-700"
              : pending
                ? "text-amber-700"
                : "text-gray-400",
          )}
        >
          {active ? "Enabled" : pending ? "Pending" : "Not connected"}
        </span>
      </div>
    </div>
  );
}

function PaymentStatusBadge({ value }: { value: string | null }) {
  const tone =
    value === "paid"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : value === "pending"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : value === "refunded"
          ? "bg-gray-100 text-gray-700 border-gray-200"
          : value === "failed"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-gray-50 text-gray-600 border-gray-200";
  const label = value ?? "—";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function formatMoney(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
