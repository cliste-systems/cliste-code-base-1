import { redirect } from "next/navigation";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { PLANS, isPlanTier, type PlanTier } from "@/lib/cliste-plans";

import { finaliseBillingCheckout } from "./actions";
import { UsageView } from "./usage-view";
import type { UsagePageData } from "./usage-helpers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Usage surface (route `/dashboard/billing`, nav label Usage):
 * plan quota, minutes used this billing period, overage estimate, billing portal.
 */
export default async function BillingPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const suspendedQuery = sp.suspended === "1";
  const status = firstParam(sp.status);
  const checkoutSessionId = firstParam(sp.session_id);

  if (status === "return" && checkoutSessionId) {
    try {
      await finaliseBillingCheckout(checkoutSessionId);
    } catch (err) {
      console.warn("[billing] finalise checkout failed", err);
    }
    redirect("/dashboard/usage?billing=ready");
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      [
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
      status: string;
      plan_tier: string | null;
      billing_period_start: string | null;
      platform_customer_id: string | null;
      platform_subscription_id: string | null;
      suspended_reason: string | null;
    }>();

  const planTier: PlanTier | null = isPlanTier(org?.plan_tier) ? org!.plan_tier : null;
  const plan = planTier ? PLANS[planTier] : null;

  const periodStart =
    org?.billing_period_start ??
    new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    )
      .toISOString()
      .slice(0, 10);

  const { data: usageRows } = await supabase
    .from("usage_records")
    .select("minutes_billable, synced_to_stripe_at")
    .eq("organization_id", organizationId)
    .gte("billing_period_start", periodStart);

  let usedMinutes = 0;
  let lastUsageSync: string | null = null;
  for (const row of usageRows ?? []) {
    const m = (row as { minutes_billable: number | null }).minutes_billable;
    usedMinutes += typeof m === "number" ? m : 0;
    const synced = (row as { synced_to_stripe_at: string | null }).synced_to_stripe_at;
    if (synced && (!lastUsageSync || synced > lastUsageSync)) {
      lastUsageSync = synced;
    }
  }

  const includedMinutes = plan?.includedMinutes ?? 0;
  const extraMinutes = Math.max(0, usedMinutes - includedMinutes);
  const remainingMinutes = Math.max(0, includedMinutes - usedMinutes);
  const progressPct =
    includedMinutes > 0
      ? Math.min(100, Math.round((usedMinutes / includedMinutes) * 100))
      : 0;
  const projectedOverageCents = plan
    ? extraMinutes * plan.overageRateCents
    : 0;

  const hasBillingPortal = Boolean(org?.platform_customer_id?.trim());
  const hasSubscription = Boolean(org?.platform_subscription_id?.trim());
  const suspended = suspendedQuery || org?.status === "suspended";
  const canManageBilling = hasBillingPortal || hasSubscription || suspended;

  const data: UsagePageData = {
    planName: plan?.name ?? "No plan",
    plan,
    usedMinutes,
    includedMinutes,
    extraMinutes,
    remainingMinutes,
    progressPct,
    projectedOverageCents,
    periodStart,
    periodEnd: null,
    callsCounted: usageRows?.length ?? 0,
    lastUsageSync,
    hasBillingPortal,
    hasSubscription,
    canManageBilling,
    suspended,
    suspendedReason: org?.suspended_reason ?? null,
  };

  const billingReady = firstParam(sp.billing) === "ready";
  const checkoutCancelled = status === "cancel";

  return (
    <div className="flex h-full min-h-0 flex-col" data-dashboard-fill>
      <UsageView
        className="min-h-0 flex-1"
        data={data}
        billingReady={billingReady}
        checkoutCancelled={checkoutCancelled}
      />
    </div>
  );
}
