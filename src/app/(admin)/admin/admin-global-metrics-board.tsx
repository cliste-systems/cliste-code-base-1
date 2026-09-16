import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bug,
  Clock3,
  LifeBuoy,
  Phone,
  ShieldAlert,
  Users,
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
  size = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "urgent";
  size?: "default" | "compact";
}) {
  const urgent = tone === "urgent";
  const compact = size === "compact";
  const inner = (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        compact ? "gap-2 px-3 py-3 sm:px-4" : "gap-3 px-4 py-5 sm:px-5 sm:py-6",
      )}
    >
      <div className="flex items-center gap-1.5 text-white/70">
        <Icon
          className={cn("shrink-0", compact ? "size-3.5" : "size-4")}
          strokeWidth={1.5}
          aria-hidden
        />
        <span
          className={cn(
            "font-medium uppercase tracking-wide",
            compact ? "text-[10px] leading-tight" : "text-[12px]",
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          "font-semibold leading-none tracking-tight tabular-nums",
          compact ? "text-2xl" : "text-[36px] sm:text-[42px]",
          urgent ? "text-red-300" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );

  const shellClass = cn(
    "block min-w-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/30",
    href && "hover:bg-white/5",
    compact && urgent && "bg-red-500/10",
  );

  if (href) {
    return (
      <Link href={href} className={shellClass}>
        {inner}
      </Link>
    );
  }

  return <div className={cn("min-w-0", compact && urgent && "bg-red-500/10")}>{inner}</div>;
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
  empty = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  empty?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5",
        className,
      )}
    >
      <h3 className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h3>
      <div
        className={cn(
          "mt-4 min-h-0 flex-1",
          empty && "flex items-center justify-center",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export type AdminGlobalMetricsBoardProps = {
  periodLabel: string;
  periodRangeLabel: string;
  calls: number;
  pipelineIncidents: number;
  postCallFailures: number;
  platformCritical: number;
  authFailures: number;
  support: number;
  organizations: number;
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
  pipelineIncidents,
  postCallFailures,
  platformCritical,
  authFailures,
  support,
  organizations,
  minutesUsed,
  callOutcomes,
  topTenants,
  recentCalls,
}: AdminGlobalMetricsBoardProps) {
  const maxTenantCalls = Math.max(1, ...topTenants.map((t) => t.calls));

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
      aria-labelledby="global-metrics-heading"
    >
      <div className="shrink-0 bg-[#0b1220]">
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

        <div className="grid grid-cols-2 divide-y divide-white/10 sm:grid-cols-4 sm:divide-y-0 lg:divide-x">
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
            label="Live tenants"
            value={formatInt(organizations)}
            icon={Users}
          />
          <HeadlineMetric
            label="Avg calls / tenant"
            value={organizations > 0 ? (calls / organizations).toFixed(1) : "—"}
            icon={Clock3}
          />
        </div>

        <div className="border-t border-white/10">
          <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45 sm:px-5">
            Ops health
          </p>
          <div className="mt-1 grid grid-cols-2 divide-y divide-white/10 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
            <HeadlineMetric
              label="Pipeline · 7d"
              value={formatInt(pipelineIncidents)}
              icon={AlertTriangle}
              href="/admin/security?view=pipeline"
              tone={pipelineIncidents > 0 ? "urgent" : "default"}
              size="compact"
            />
            <HeadlineMetric
              label="Post-call · 7d"
              value={formatInt(postCallFailures)}
              icon={AlertTriangle}
              href="/admin/post-call-health"
              tone={postCallFailures > 0 ? "urgent" : "default"}
              size="compact"
            />
            <HeadlineMetric
              label="Platform · 7d"
              value={formatInt(platformCritical)}
              icon={Bug}
              href="/admin/platform-health"
              tone={platformCritical > 0 ? "urgent" : "default"}
              size="compact"
            />
            <HeadlineMetric
              label="Auth fails · 24h"
              value={formatInt(authFailures)}
              icon={ShieldAlert}
              href="/admin/security"
              tone={authFailures > 0 ? "urgent" : "default"}
              size="compact"
            />
            <HeadlineMetric
              label="Open support"
              value={formatInt(support)}
              icon={LifeBuoy}
              href="/admin/support"
              size="compact"
            />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr gap-4 overflow-hidden bg-slate-50/80 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <Panel title="Call outcomes" empty={!callOutcomes.some((s) => s.value > 0)}>
          {callOutcomes.some((s) => s.value > 0) ? (
            <ul className="space-y-3 overflow-y-auto">
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

        <Panel title="Top tenants by calls" empty={topTenants.length === 0}>
          {topTenants.length > 0 ? (
            <ul className="space-y-3 overflow-y-auto">
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

        <Panel
          title="Recent calls"
          className="sm:col-span-2 lg:col-span-1"
          empty={recentCalls.length === 0}
        >
          {recentCalls.length > 0 ? (
            <ul className="divide-y divide-slate-100 overflow-y-auto">
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
