"use client";

import Link from "next/link";
import { Activity } from "lucide-react";

import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  DashboardHomeFirstRowButton,
  DashboardHomeFirstRowList,
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
    <div className="flex min-h-[5.75rem] flex-1 items-center gap-3 px-1">
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 size-9 shrink-0 shadow-none")} aria-hidden>
        <Activity className="size-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[13px]")}>
          No customer activity yet
        </p>
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-0.5 max-w-none text-[11.5px]")}>
          Recent customer calls will appear here.
        </p>
      </div>
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
        <h2 className={HOME_FIRST_ROW_TITLE}>Recent activity</h2>
        <span className={HOME_FIRST_ROW_HEADER_META}>
          <span className="size-1.5 rounded-full bg-slate-400" aria-hidden />
          Live
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
            {embedded ? (
              <Link
                href={DASHBOARD_ROUTES.activity}
                className="inline-flex text-[11px] font-medium text-[#4d5f58] transition-colors hover:text-[#11181d]"
              >
                View all activity →
              </Link>
            ) : (
              <DashboardHomeFirstRowButton href={DASHBOARD_ROUTES.activity}>
                View all activity
              </DashboardHomeFirstRowButton>
            )}
          </div>
        </>
      ) : (
        <LiveActivityEmptyState />
      )}
    </Shell>
  );
}
