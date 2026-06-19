"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

import {
  DashboardHomeFirstRowButton,
  HOME_FIRST_ROW_COUNT_BADGE,
  HOME_FIRST_ROW_EMPTY,
  HOME_FIRST_ROW_FOOTER,
  HOME_FIRST_ROW_HEADER,
  HOME_FIRST_ROW_LIST,
  HOME_FIRST_ROW_LIST_ROW,
  HOME_FIRST_ROW_LIST_SUBTITLE,
  HOME_FIRST_ROW_LIST_TIME,
  HOME_FIRST_ROW_LIST_TITLE,
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
        <h2 className={HOME_FIRST_ROW_TITLE}>Cara training</h2>
        <span className={HOME_FIRST_ROW_COUNT_BADGE}>{openTrainingCount}</span>
      </div>

      {displayRows.length > 0 ? (
        <>
          <ul className={cn(HOME_FIRST_ROW_LIST, "min-h-0 flex-1 overflow-y-auto overscroll-y-contain")}>
            {displayRows.map((row) => (
              <li key={row.id} className="border-b border-slate-100 last:border-b-0">
                <Link href={row.href} className={HOME_FIRST_ROW_LIST_ROW}>
                  <span className="min-w-0 flex-1">
                    <span className={HOME_FIRST_ROW_LIST_TITLE}>{row.title}</span>
                    <span className={HOME_FIRST_ROW_LIST_SUBTITLE}>
                      {row.description}
                    </span>
                  </span>
                  <span className={HOME_FIRST_ROW_LIST_TIME}>{row.time}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className={cn(HOME_FIRST_ROW_FOOTER, "mt-auto")}>
            <DashboardHomeFirstRowButton href={DASHBOARD_ROUTES.caraTraining}>
              Open Cara training
            </DashboardHomeFirstRowButton>
          </div>
        </>
      ) : (
        <CaraTrainingEmptyState />
      )}
    </Shell>
  );
}
