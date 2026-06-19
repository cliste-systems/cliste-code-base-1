import { PieChart } from "lucide-react";

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
import {
  analyticsSegmentsTotal,
  type AnalyticsSegment,
} from "@/lib/dashboard-home-analytics";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function CallOutcomesEmptyState() {
  return (
    <div className="flex flex-1 items-center gap-2.5">
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 size-9")} aria-hidden>
        <PieChart className="size-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[13px]")}>
          No calls yet
        </p>
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-0.5 max-w-none text-[11px]")}>
          Outcome mix will appear once Cara starts taking calls.
        </p>
      </div>
    </div>
  );
}

export function DashboardHomeCallOutcomesCard({
  segments,
  className,
  embedded = false,
}: {
  segments: AnalyticsSegment[];
  className?: string;
  embedded?: boolean;
}) {
  const total = analyticsSegmentsTotal(segments);
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <h2 className="mb-2 shrink-0 text-[14px] font-semibold tracking-tight text-[#0b1220]">
        Call outcomes
      </h2>

      {total > 0 ? (
        <div className="flex min-h-0 flex-1 items-center gap-2 overflow-hidden">
          <DashboardDonutChart segments={segments} size={64} />
          <DashboardAnalyticsLegend
            segments={segments}
            className="min-w-0 space-y-0.5 text-[11px] leading-tight"
          />
        </div>
      ) : (
        <CallOutcomesEmptyState />
      )}

      <div className="mt-auto shrink-0 pt-2">
        <DashboardHomePanelOutlineLink href={DASHBOARD_ROUTES.calls}>
          View full report
        </DashboardHomePanelOutlineLink>
      </div>
    </Shell>
  );
}
