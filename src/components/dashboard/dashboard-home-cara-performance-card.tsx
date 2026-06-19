import { Radio } from "lucide-react";

import {
  DashboardHomePanelOutlineLink,
} from "@/components/dashboard/dashboard-home-first-row";
import {
  DashboardAnalyticsLegend,
  DashboardDonutChart,
} from "@/components/dashboard/dashboard-donut-chart";
import {
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import { analyticsSegmentsTotal } from "@/lib/dashboard-home-analytics";
import type { HomeCaraPerformanceSnapshot } from "@/lib/dashboard-home-cara-performance";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function CaraPerformanceEmptyState() {
  return (
    <div className="flex flex-1 items-center gap-2.5">
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 size-9")} aria-hidden>
        <Radio className="size-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[13px]")}>
          No calls yet
        </p>
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-0.5 max-w-none text-[11px]")}>
          Call quality will appear once Cara starts taking calls.
        </p>
      </div>
    </div>
  );
}

export function DashboardHomeCaraPerformanceCard({
  performance,
  className,
  embedded = false,
}: {
  performance: HomeCaraPerformanceSnapshot;
  className?: string;
  embedded?: boolean;
}) {
  const hasCalls = analyticsSegmentsTotal(performance.qualitySegments) > 0;
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <h2 className="mb-2 shrink-0 text-[14px] font-semibold tracking-tight text-[#0b1220]">
        Cara
      </h2>

      {hasCalls ? (
        <div className="flex min-h-0 flex-1 items-center gap-2 overflow-hidden">
          <DashboardDonutChart segments={performance.qualitySegments} size={64} />
          <div className="min-w-0 flex-1 overflow-hidden">
            <DashboardAnalyticsLegend
              segments={performance.qualitySegments}
              className="space-y-0.5 text-[11px] leading-tight"
            />
            <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] leading-tight text-slate-500">
              Avg duration{" "}
              <span className="font-semibold tabular-nums text-[#0b1220]">
                {performance.avgDurationLabel}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <CaraPerformanceEmptyState />
      )}

      <div className="mt-auto shrink-0 pt-2">
        <DashboardHomePanelOutlineLink
          href={performance.isOnline ? DASHBOARD_ROUTES.calls : DASHBOARD_ROUTES.businessProfile}
        >
          {performance.isOnline ? "View calls" : "Finish setup"}
        </DashboardHomePanelOutlineLink>
      </div>
    </Shell>
  );
}
