import { AlertTriangle, Gauge } from "lucide-react";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { PLANS, isPlanTier, type PlanTier } from "@/lib/cliste-plans";

import { OpenBillingPortalButton } from "./portal-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Billing / Usage surface:
 *   - Current plan tier + included minute quota.
 *   - AI call minutes used this billing period (sum of usage_records).
 *   - Overage price, soft alert thresholds (80% / 100% quota).
 *   - Manage-subscription button → Stripe Customer Portal.
 *
 * Doubles as the suspended-account landing page: post-login redirects any
 * suspended org here with ?suspended=1 so the operator can get back online.
 */
export default async function BillingPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const suspended = sp.suspended === "1";

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      [
        "id",
        "name",
        "status",
        "plan_tier",
        "billing_period_start",
        "platform_customer_id",
        "platform_subscription_id",
        "suspended_reason",
      ].join(", "),
    )
    .eq("id", organizationId)
    .maybeSingle<{
      id: string;
      name: string | null;
      status: string;
      plan_tier: string | null;
      billing_period_start: string | null;
      platform_customer_id: string | null;
      platform_subscription_id: string | null;
      suspended_reason: string | null;
    }>();

  const planTier: PlanTier = isPlanTier(org?.plan_tier) ? org!.plan_tier : "pro";
  const plan = PLANS[planTier];

  const periodStart =
    org?.billing_period_start ??
    new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    )
      .toISOString()
      .slice(0, 10);

  const { data: usageRows } = await supabase
    .from("usage_records")
    .select("minutes_billable")
    .eq("organization_id", organizationId)
    .gte("billing_period_start", periodStart);

  const usedMinutes = (usageRows ?? []).reduce((acc, r) => {
    const m = (r as { minutes_billable: number | null }).minutes_billable;
    return acc + (typeof m === "number" ? m : 0);
  }, 0);

  const quota = plan.includedMinutes;
  const pctOfQuota = quota > 0 ? Math.min(100, Math.round((usedMinutes / quota) * 100)) : 0;
  const overMinutes = Math.max(0, usedMinutes - quota);
  const projectedOverageCents = overMinutes * plan.overageRateCents;

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Billing & usage</h1>
        <p className="text-sm text-gray-500">
          {org?.name ? `${org.name} — ` : ""}Cliste platform subscription.
        </p>
      </header>

      {suspended || org?.status === "suspended" ? (
        <section className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Your Cliste subscription is paused.</p>
            <p>
              {org?.suspended_reason ??
                "The last invoice could not be charged. Update your card to bring your AI receptionist back online."}
            </p>
            {org?.platform_customer_id ? (
              <OpenBillingPortalButton className="mt-2" />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Current plan
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">
              Cliste {plan.name}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{plan.tagline}</p>
          </div>
          {org?.platform_customer_id ? <OpenBillingPortalButton /> : null}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">
              Base price
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatEuro(plan.monthlyCents)} /month
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">
              Included minutes
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {plan.includedMinutes.toLocaleString("en-IE")} minutes /month
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">
              Overage rate
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatEuroFromCents(plan.overageRateCents)} /minute
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Gauge className="h-4 w-4 text-gray-500" /> Usage this period
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Billing period started {formatDate(periodStart)}.
        </p>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-gray-900">
              {usedMinutes.toLocaleString("en-IE")} minutes
            </span>
            <span className="text-gray-500">
              of {plan.includedMinutes.toLocaleString("en-IE")} included
            </span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={
                pctOfQuota >= 100
                  ? "h-full bg-red-500"
                  : pctOfQuota >= 80
                    ? "h-full bg-amber-500"
                    : "h-full bg-emerald-500"
              }
              style={{ width: `${Math.min(100, pctOfQuota)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {overMinutes > 0
              ? `${overMinutes.toLocaleString("en-IE")} minute${overMinutes === 1 ? "" : "s"} over — estimated overage ${formatEuroFromCents(projectedOverageCents)}.`
              : `${Math.max(0, plan.includedMinutes - usedMinutes).toLocaleString("en-IE")} minute${plan.includedMinutes - usedMinutes === 1 ? "" : "s"} remaining before overage kicks in.`}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
        <p className="font-semibold text-gray-900">Want more minutes?</p>
        <p className="mt-1">
          Upgrading takes effect immediately; your next invoice pro-rates. The
          {" "}
          <a
            href="/"
            className="font-semibold text-blue-600 underline-offset-2 hover:underline"
          >
            pricing page
          </a>
          {" "}
          compares all plans side-by-side.
        </p>
      </section>
    </div>
  );
}

function formatEuro(cents: number): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `€${(cents / 100).toFixed(0)}`;
  }
}

function formatEuroFromCents(cents: number): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `€${(cents / 100).toFixed(2)}`;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
