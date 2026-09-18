import { AlertCircle } from "lucide-react";

import {
  DashboardHomeFirstRowButton,
  DashboardHomeFirstRowList,
  HOME_FIRST_ROW_COUNT_BADGE,
  HOME_FIRST_ROW_EMPTY,
  HOME_FIRST_ROW_FOOTER,
  HOME_FIRST_ROW_HEADER,
  HOME_FIRST_ROW_TITLE,
} from "@/components/dashboard/dashboard-home-first-row";
import {
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import type { HomeCallReviewRow } from "@/lib/dashboard-home-calls-to-review";
import { DASHBOARD_HOME_SECOND_ROW_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function CallsToReviewEmptyState() {
  return (
    <div className={HOME_FIRST_ROW_EMPTY}>
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-2 size-10")} aria-hidden>
        <AlertCircle className="size-5" />
      </div>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[14px]")}>
        Nothing to review
      </p>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-1 max-w-none text-[12px]")}>
        Short hang-ups, incomplete calls, and processing issues will appear here.
      </p>
    </div>
  );
}

export function DashboardHomeCallsToReviewCard({
  rows,
  reviewCount,
  className,
  embedded = false,
}: {
  rows: HomeCallReviewRow[];
  reviewCount: number;
  className?: string;
  embedded?: boolean;
}) {
  const displayRows = rows.slice(0, DASHBOARD_HOME_SECOND_ROW_DISPLAY_LIMIT);
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <div className={HOME_FIRST_ROW_HEADER}>
        <h2 className={HOME_FIRST_ROW_TITLE}>Calls to review</h2>
        <span className={HOME_FIRST_ROW_COUNT_BADGE}>{reviewCount}</span>
      </div>

      {displayRows.length > 0 ? (
        <DashboardHomeFirstRowList
          rows={displayRows.map((row) => ({
            id: row.id,
            href: row.href,
            title: row.title,
            subtitle: row.subtitle,
            time: row.time,
          }))}
        />
      ) : (
        <CallsToReviewEmptyState />
      )}

      <div className={HOME_FIRST_ROW_FOOTER}>
        <DashboardHomeFirstRowButton href={DASHBOARD_ROUTES.calls}>
          Open calls
        </DashboardHomeFirstRowButton>
      </div>
    </Shell>
  );
}
