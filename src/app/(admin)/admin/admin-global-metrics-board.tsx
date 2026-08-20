import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock3,
  Inbox,
  LifeBuoy,
  Phone,
  Ticket,
} from "lucide-react";

import type { AnalyticsSegment } from "@/lib/dashboard-home-analytics";
import { cn } from "@/lib/utils";

import { AdminMetricRangeToggle } from "./admin-metric-range-toggle";

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-IE").format(n);
}

function HeadlineMetric({
  label,
  value,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "urgent";
}) {
  const urgent = tone === "urgent";
  const inner = (
    <div className="flex min-w-0 flex-col gap-3 px-4 py-5 sm:px-5 sm:py-6">
      <div className="flex items-center gap-2 text-white/70">
        <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="text-[12px] font-medium tracking-wide uppercase">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-[36px] font-semibold leading-none tracking-tight tabular-nums sm:text-[42px]",
          urgent ? "text-red-300" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block min-w-0 outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/30"
      >
        {inner}
      </Link>
    );
  }

  return <div className="min-w-0">{inner}</div>;
}

function BreakdownBar({ segment }: { segment: AnalyticsSegment }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-700">{segment.label}</span>
        <span className="shrink-0 font-medium tabular-nums text-[#0b1220]">
          {formatInt(segment.value)}
          {segment.percent > 0 ? (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              {segment.percent}%
            </span>
          ) : null}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#0b1220] transition-all"
          style={{ width: `${Math.max(segment.percent, segment.value > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5",
        className,
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h3>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </div>
  );
}

export type AdminGlobalMetricsBoardProps = {
  periodLabel: string;
  periodRangeLabel: string;
  calls: number;
  openInbox: number;
  urgent: number;
  support: number;
  organizations: number;
  ticketsCreated: number;
  minutesUsed: string;
  callOutcomes: AnalyticsSegment[];
  topTenants: { orgId: string; name: string; calls: number }[];
  recentCalls: {
    id: string;
    orgName: string;
    caller: string;
    outcomeLabel: string;
    timeLabel: string;
  }[];
};

export function AdminGlobalMetricsBoard({
  periodLabel,
  periodRangeLabel,
  calls,
  openInbox,
  urgent,
  support,
  organizations,
  ticketsCreated,
  minutesUsed,
  callOutcomes,
  topTenants,
  recentCalls,
}: AdminGlobalMetricsBoardProps) {
  const maxTenantCalls = Math.max(1, ...topTenants.map((t) => t.calls));

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
      aria-labelledby="global-metrics-heading"
    >
      <div className="bg-[#0b1220]">
        <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Platform overview
            </p>
            <h2
              id="global-metrics-heading"
              className="mt-1 text-lg font-semibold text-white sm:text-xl"
            >
              Global metrics
            </h2>
            <p className="mt-0.5 text-sm text-white/60">
              {periodLabel} · {periodRangeLabel}
            </p>
          </div>
          <Suspense
            fallback={
              <div className="h-9 w-[200px] animate-pulse rounded-full bg-white/10" />
            }
          >
            <AdminMetricRangeToggle variant="dark" />
          </Suspense>
        </div>

        <div className="grid grid-cols-2 divide-y divide-white/10 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
          <HeadlineMetric
            label={`Calls · ${periodLabel.toLowerCase()}`}
            value={formatInt(calls)}
            icon={Phone}
          />
          <HeadlineMetric
            label="Billable minutes"
            value={minutesUsed}
            icon={Clock3}
          />
          <HeadlineMetric
            label="Tickets captured"
            value={formatInt(ticketsCreated)}
            icon={Ticket}
          />
          <HeadlineMetric
            label="Open inbox"
            value={formatInt(openInbox)}
            icon={Inbox}
          />
          <HeadlineMetric
            label="Urgent"
            value={formatInt(urgent)}
            icon={AlertTriangle}
            tone={urgent > 0 ? "urgent" : "default"}
          />
          <HeadlineMetric
            label="Support"
            value={formatInt(support)}
            icon={LifeBuoy}
            href="/admin/support"
          />
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-2">
          <div className="bg-[#0b1220] px-4 py-3 sm:px-5">
            <p className="text-[11px] uppercase tracking-wide text-white/45">
              Live tenants
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {formatInt(organizations)}
            </p>
          </div>
          <div className="bg-[#0b1220] px-4 py-3 sm:px-5">
            <p className="text-[11px] uppercase tracking-wide text-white/45">
              Avg calls per tenant
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {organizations > 0
                ? (calls / organizations).toFixed(1)
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 bg-slate-50/80 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <Panel title="Call outcomes">
          {callOutcomes.some((s) => s.value > 0) ? (
            <ul className="space-y-3">
              {callOutcomes.map((segment) => (
                <li key={segment.id}>
                  <BreakdownBar segment={segment} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No calls in this period.</p>
          )}
        </Panel>

        <Panel title="Top tenants by calls">
          {topTenants.length > 0 ? (
            <ul className="space-y-3">
              {topTenants.map((tenant) => (
                <li key={tenant.orgId}>
                  <Link
                    href={`/admin/organizations/${tenant.orgId}`}
                    className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-[#0b1220] group-hover:underline">
                        {tenant.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {formatInt(tenant.calls)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-700"
                        style={{
                          width: `${Math.round((tenant.calls / maxTenantCalls) * 100)}%`,
                        }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No tenant call activity yet.</p>
          )}
        </Panel>

        <Panel title="Recent calls" className="sm:col-span-2 lg:col-span-1">
          {recentCalls.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {recentCalls.map((call) => (
                <li
                  key={call.id}
                  className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0b1220]">
                      {call.orgName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {call.caller} · {call.outcomeLabel}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {call.timeLabel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No recent calls.</p>
          )}
        </Panel>
      </div>
    </section>
  );
}
