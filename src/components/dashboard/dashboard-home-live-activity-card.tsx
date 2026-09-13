"use client";

import { Activity } from "lucide-react";

import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  DashboardHomeFirstRowButton,
  DashboardHomeFirstRowList,
  HOME_FIRST_ROW_EMPTY,
  HOME_FIRST_ROW_FOOTER,
  HOME_FIRST_ROW_HEADER,
  HOME_FIRST_ROW_HEADER_META,
  HOME_FIRST_ROW_TITLE,
} from "@/components/dashboard/dashboard-home-first-row";
import {
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { DASHBOARD_HOME_LIVE_ACTIVITY_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { cn } from "@/lib/utils";

function LiveActivityEmptyState() {
  return (
    <div className={HOME_FIRST_ROW_EMPTY}>
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-2 size-10")} aria-hidden>
        <Activity className="size-5" />
      </div>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[14px]")}>
        No activity yet
      </p>
      <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-1 max-w-none text-[12px]")}>
        Calls, requests and actions will appear here once Cara starts taking
        calls.
      </p>
    </div>
  );
}

export function DashboardHomeLiveActivityCard({
  activity,
  className,
  embedded = false,
}: {
  activity: TimelineFeedRow[];
  className?: string;
  embedded?: boolean;
}) {
  const rows = activity.slice(0, DASHBOARD_HOME_LIVE_ACTIVITY_DISPLAY_LIMIT);
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <div className={HOME_FIRST_ROW_HEADER}>
        <h2 className={HOME_FIRST_ROW_TITLE}>Live activity</h2>
        <span className={HOME_FIRST_ROW_HEADER_META}>
          <span className="size-1.5 rounded-full bg-slate-400" aria-hidden />
          Now
        </span>
      </div>

      {rows.length > 0 ? (
        <>
          <DashboardHomeFirstRowList
            rows={rows.map((row) => ({
              id: row.id,
              href: row.href,
              title: row.title,
              subtitle: row.subtitle,
              time: row.time,
            }))}
          />

          <div className={cn(HOME_FIRST_ROW_FOOTER, "mt-auto")}>
            <DashboardHomeFirstRowButton href={DASHBOARD_ROUTES.activity}>
              View all activity
            </DashboardHomeFirstRowButton>
          </div>
        </>
      ) : (
        <LiveActivityEmptyState />
      )}
    </Shell>
  );
}
