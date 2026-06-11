import { AlertTriangle, Gauge } from "lucide-react";
import type { ReactNode } from "react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardStatStrip } from "@/components/dashboard/dashboard-stat-strip";
import {
  DASHBOARD_HOME_CARD,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

import { OpenBillingPortalButton } from "./portal-button";
import { SetupBillingButton } from "./setup-billing-button";
import {
  buildUsageSummary,
  formatBillingPeriodRenewal,
  formatDate,
  formatDateTime,
  formatEuro,
  formatEuroFromCents,
  formatMinutes,
  type UsagePageData,
} from "./usage-helpers";

type UsageViewProps = {
  data: UsagePageData;
  className?: string;
  billingReady?: boolean;
  checkoutCancelled?: boolean;
};

export function UsageView({
  data,
  className,
  billingReady = false,
  checkoutCancelled = false,
}: UsageViewProps) {
  const summary = buildUsageSummary(data);
  const renewalDate = formatBillingPeriodRenewal(data.periodStart);
  const estimatedExtra = formatEuroFromCents(data.projectedOverageCents);

  const portalButtonClass =
    "[&_button]:h-10 [&_button]:rounded-xl [&_button]:bg-[#0b1220] [&_button]:px-4 [&_button]:text-[13px] [&_button]:font-medium [&_button]:hover:bg-[#0b1220]/90";

  return (
    <div
      className={cn(
        DASHBOARD_PAGE_SHELL_FILL_WHITE,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <DashboardAnimatedPageSections className="overflow-y-auto overscroll-y-contain">
      <DashboardPageHeader
        eyebrow="Usage"
        title="Usage"
        icon={Gauge}
        description="Minutes used this billing period and what your plan includes."
        summary={[
          { value: data.planName, label: "plan" },
          { value: formatMinutes(data.usedMinutes), label: "used" },
          {
            value:
              data.includedMinutes > 0
                ? formatMinutes(data.includedMinutes)
                : "—",
            label: "included",
          },
        ]}
        actions={
          data.canManageBilling ? (
            <OpenBillingPortalButton className={portalButtonClass} />
          ) : null
        }
      />

      {data.suspended ? (
        <UsageAlert tone="warning" icon={AlertTriangle}>
          <p className="font-semibold">Your subscription is paused.</p>
          <p className="mt-1 leading-relaxed opacity-90">
            {data.suspendedReason ??
              "The last invoice could not be charged. Update your billing details to bring Cara back online."}
          </p>
        </UsageAlert>
      ) : null}

      {billingReady ? (
        <UsageAlert tone="success">
          <p className="font-semibold">Billing is connected.</p>
          <p className="mt-1 leading-relaxed opacity-90">
            Manage payment methods and invoices below.
          </p>
        </UsageAlert>
      ) : null}

      {checkoutCancelled ? (
        <UsageAlert tone="neutral">
          Checkout was cancelled. You can try again when you are ready.
        </UsageAlert>
      ) : null}

      <section className={cn(DASHBOARD_HOME_CARD, "shrink-0")}>
        <DashboardStatStrip
          compact
          stats={[
            { label: "Minutes used", value: formatMinutes(data.usedMinutes) },
            {
              label: "Included",
              value:
                data.includedMinutes > 0
                  ? formatMinutes(data.includedMinutes)
                  : "—",
            },
            {
              label: "Remaining",
              value:
                data.includedMinutes > 0
                  ? formatMinutes(data.remainingMinutes)
                  : "—",
            },
            { label: "Extra minutes", value: formatMinutes(data.extraMinutes) },
            { label: "Calls counted", value: String(data.callsCounted) },
          ]}
        />
      </section>

      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className={DASHBOARD_HOME_CARD}>
          <h2 className="shrink-0 text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Minutes this period
          </h2>

          <div className="mt-4">
            <div className="flex items-end gap-2">
              <p className="text-[40px] font-semibold leading-none tracking-tight tabular-nums text-[#0b1220] sm:text-[48px]">
                {formatMinutes(data.usedMinutes)}
              </p>
              {data.includedMinutes > 0 ? (
                <p className="mb-1.5 text-[16px] font-medium tabular-nums text-slate-400">
                  / {formatMinutes(data.includedMinutes)}
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-[14px] font-medium text-[#0b1220]">
              {summary.primary}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-slate-500">
              {summary.secondary}
            </p>
            <p className="mt-2 text-[12px] leading-snug text-slate-500">
              Minutes are based on actual call length (to the second), not
              rounded up per call.
            </p>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
                <span className="font-medium text-slate-600">Period usage</span>
                <span className="tabular-nums text-slate-500">
                  {data.progressPct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    data.progressPct >= 90
                      ? "bg-amber-600"
                      : "bg-[#0b1220]",
                  )}
                  style={{
                    width: `${Math.max(data.progressPct, data.usedMinutes > 0 ? 2 : 0)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <PeriodFact label="Period start" value={formatDate(data.periodStart)} />
            <PeriodFact label="Renews" value={renewalDate} />
            <PeriodFact
              label="Last sync"
              value={formatDateTime(data.lastUsageSync)}
            />
            <PeriodFact label="Source" value="Cara call records" />
          </dl>
        </section>

        <section className={DASHBOARD_HOME_CARD}>
          <h2 className="shrink-0 text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Your plan
          </h2>

          {data.plan ? (
            <>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[16px] font-semibold tracking-tight text-[#0b1220]">
                  {data.plan.name}
                </p>
                <p className="mt-2 text-[22px] font-semibold tabular-nums text-[#0b1220]">
                  {formatEuro(data.plan.monthlyCents)}
                  <span className="text-[13px] font-medium text-slate-500">
                    {" "}
                    / month
                  </span>
                </p>
              </div>

              <dl className="mt-3 space-y-2.5">
                <PlanRow
                  label="Included minutes"
                  value={`${data.plan.includedMinutes.toLocaleString("en-IE")} / month`}
                />
                <PlanRow
                  label="Included SMS"
                  value={`${data.plan.includedSms.toLocaleString("en-IE")} / month`}
                />
                <PlanRow
                  label="Extra minute rate"
                  value={`${formatEuroFromCents(data.plan.overageRateCents)} / min`}
                />
                <PlanRow
                  label="Extra SMS rate"
                  value={`${formatEuroFromCents(data.plan.smsOverageRateCents)} / SMS`}
                />
                <PlanRow
                  label="Estimated extra cost"
                  value={estimatedExtra}
                />
              </dl>
            </>
          ) : (
            <p className="mt-3 shrink-0 text-[13px] leading-relaxed text-slate-600">
              No plan is active yet. Choose a plan to get included minutes and
              call handling.
            </p>
          )}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="text-[14px] font-semibold tracking-tight text-[#0b1220]">
              Billing
            </h3>
            {data.canManageBilling ? (
              <>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
                  Update your payment method, view invoices, and manage your
                  subscription in Stripe.
                </p>
                <OpenBillingPortalButton
                  className={cn(
                    "mt-3",
                    "[&_button]:h-10 [&_button]:w-full",
                    portalButtonClass,
                  )}
                />
              </>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
                  Connect billing for your {data.planName} plan on Stripe.
                </p>
                <SetupBillingButton className="mt-3" label="Set up billing" />
              </>
            )}
          </div>
        </section>
      </div>
      </DashboardAnimatedPageSections>
    </div>
  );
}

function UsageAlert({
  children,
  tone,
  icon: Icon,
}: {
  children: ReactNode;
  tone: "warning" | "success" | "neutral";
  icon?: typeof AlertTriangle;
}) {
  const styles = {
    warning: "border-amber-200 bg-amber-50/80 text-amber-950",
    success: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    neutral: "border-slate-200 bg-white text-slate-700",
  }[tone];

  return (
    <section
      className={cn(
        "flex shrink-0 gap-3 rounded-2xl border px-4 py-3.5 text-[13px] sm:px-5",
        styles,
      )}
    >
      {Icon ? (
        <Icon className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden />
      ) : null}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function PeriodFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium tabular-nums text-[#0b1220]">
        {value}
      </dd>
    </div>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-[13px] text-slate-600">{label}</dt>
      <dd className="shrink-0 text-[13px] font-medium tabular-nums text-[#0b1220]">
        {value}
      </dd>
    </div>
  );
}
