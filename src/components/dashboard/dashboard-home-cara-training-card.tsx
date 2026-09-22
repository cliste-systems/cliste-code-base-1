"use client";

import { GraduationCap } from "lucide-react";

import {
  DashboardHomeFirstRowBody,
  DashboardHomeFirstRowHeader,
  DashboardHomeFirstRowList,
  DashboardHomePanelEmptyState,
} from "@/components/dashboard/dashboard-home-first-row";
import { dashboardHomeCardShellClassName } from "@/components/dashboard/dashboard-surface";
import type { HomeCaraTrainingRow } from "@/lib/dashboard-home-requests";
import { DASHBOARD_HOME_CARA_TRAINING_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";

export function DashboardHomeCaraTrainingCard({
  rows,
  openTrainingCount,
  className,
  embedded = false,
}: {
  rows: HomeCaraTrainingRow[];
  openTrainingCount: number;
  className?: string;
  embedded?: boolean;
}) {
  const displayRows = rows.slice(0, DASHBOARD_HOME_CARA_TRAINING_DISPLAY_LIMIT);
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <DashboardHomeFirstRowHeader
        title="Needs input"
        icon={GraduationCap}
        count={openTrainingCount}
        embedded={embedded}
      />

      <DashboardHomeFirstRowBody embedded={embedded}>
        {displayRows.length > 0 ? (
          <DashboardHomeFirstRowList
            embedded={embedded}
            showDepartmentIcons
            rows={displayRows.map((row) => ({
              id: row.id,
              href: row.href,
              title: row.title,
              subtitle: row.description,
              time: row.time,
              departmentSlug: row.departmentSlug,
            }))}
          />
        ) : (
          <DashboardHomePanelEmptyState
            embedded={embedded}
            icon={GraduationCap}
            title="Cara is up to date"
            body="Questions she could not answer will appear here for the team to teach."
          />
        )}
      </DashboardHomeFirstRowBody>
    </Shell>
  );
}
