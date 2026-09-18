import { MessageSquareText } from "lucide-react";

import {
  DashboardHomeFirstRowButton,
  DashboardHomeFirstRowList,
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
import type { HomeTopTopicRow } from "@/lib/dashboard-home-top-topics";
import { DASHBOARD_HOME_SECOND_ROW_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function formatTopicCount(count: number): string {
  return `${count} call${count === 1 ? "" : "s"}`;
}

function TopTopicsEmptyState() {
  return (
    <div className={HOME_FIRST_ROW_EMPTY}>
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-2 size-10")} aria-hidden>
        <MessageSquareText className="size-5" />
      </div>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[14px]")}>
        No topics yet
      </p>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-1 max-w-none text-[12px]")}>
        Common caller questions will appear here once Cara handles more calls.
      </p>
    </div>
  );
}

export function DashboardHomeTopTopicsCard({
  topics,
  className,
  embedded = false,
}: {
  topics: HomeTopTopicRow[];
  className?: string;
  embedded?: boolean;
}) {
  const displayRows = topics.slice(0, DASHBOARD_HOME_SECOND_ROW_DISPLAY_LIMIT);
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <div className={HOME_FIRST_ROW_HEADER}>
        <h2 className={HOME_FIRST_ROW_TITLE}>Top topics</h2>
      </div>

      {displayRows.length > 0 ? (
        <DashboardHomeFirstRowList
          rows={displayRows.map((row) => ({
            id: row.id,
            href: DASHBOARD_ROUTES.calls,
            title: row.label,
            time: formatTopicCount(row.count),
          }))}
        />
      ) : (
        <TopTopicsEmptyState />
      )}

      <div className={HOME_FIRST_ROW_FOOTER}>
        <DashboardHomeFirstRowButton href={DASHBOARD_ROUTES.calls}>
          View call history
        </DashboardHomeFirstRowButton>
      </div>
    </Shell>
  );
}
