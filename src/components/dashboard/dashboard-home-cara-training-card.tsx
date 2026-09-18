"use client";

import { GraduationCap } from "lucide-react";

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
import type { HomeCaraTrainingRow } from "@/lib/dashboard-home-requests";
import { DASHBOARD_HOME_CARA_TRAINING_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function CaraTrainingEmptyState() {
  return (
    <div className={HOME_FIRST_ROW_EMPTY}>
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-2 size-10")} aria-hidden>
        <GraduationCap className="size-5" />
      </div>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[14px]")}>
        Cara is up to date
      </p>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-1 max-w-none text-[12px]")}>
        When Cara cannot answer something on a call, it will appear here for you
        to teach her.
      </p>
    </div>
  );
}

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
      <div className={HOME_FIRST_ROW_HEADER}>
        <h2 className={HOME_FIRST_ROW_TITLE}>Needs your input</h2>
        <span className={HOME_FIRST_ROW_COUNT_BADGE}>{openTrainingCount}</span>
      </div>

      {displayRows.length > 0 ? (
        <>
          <DashboardHomeFirstRowList
            rows={displayRows.map((row) => ({
              id: row.id,
              href: row.href,
              title: row.title,
              subtitle: row.description,
              time: row.time,
            }))}
          />

          <div className={cn(HOME_FIRST_ROW_FOOTER, "mt-auto")}>
            <DashboardHomeFirstRowButton href={DASHBOARD_ROUTES.caraKnowledgeNeedsInput}>
              Open needs your input
            </DashboardHomeFirstRowButton>
          </div>
        </>
      ) : (
        <CaraTrainingEmptyState />
      )}
    </Shell>
  );
}
