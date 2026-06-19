"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Inbox,
  Phone,
  PhoneForwarded,
  PhoneMissed,
  Voicemail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  DashboardHomeFirstRowButton,
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
  DASHBOARD_ICON_CHIP_SM,
  DASHBOARD_ICON_GLYPH_SM,
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { DASHBOARD_HOME_LIVE_ACTIVITY_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { cn } from "@/lib/utils";

function activityRowIcon(action: string | undefined): LucideIcon {
  const label = action?.trim().toLowerCase() ?? "";
  if (label.includes("request captured") || label.includes("follow-up")) {
    return Inbox;
  }
  if (
    label.includes("link sent") ||
    label.includes("pdf sent") ||
    label.includes("file sent")
  ) {
    return ArrowUpRight;
  }
  if (label.includes("callback")) return PhoneForwarded;
  if (label.includes("missed")) return PhoneMissed;
  if (label.includes("voicemail")) return Voicemail;
  return Phone;
}

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
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="size-1.5 rounded-full bg-slate-400" aria-hidden />
          Now
        </span>
      </div>

      {rows.length > 0 ? (
        <>
          <ul className={cn(HOME_FIRST_ROW_LIST, "min-h-0 flex-1 overflow-y-auto overscroll-y-contain")}>
            {rows.map((row) => {
              const Icon = activityRowIcon(row.subtitle ?? row.badge);
              return (
                <li key={row.id} className="border-b border-slate-100 last:border-b-0">
                  <Link href={row.href} className={HOME_FIRST_ROW_LIST_ROW}>
                    <span className={DASHBOARD_ICON_CHIP_SM} aria-hidden>
                      <Icon className={DASHBOARD_ICON_GLYPH_SM} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={HOME_FIRST_ROW_LIST_TITLE}>{row.title}</span>
                      {row.subtitle ? (
                        <span className={HOME_FIRST_ROW_LIST_SUBTITLE}>
                          {row.subtitle}
                        </span>
                      ) : null}
                    </span>
                    <span className={HOME_FIRST_ROW_LIST_TIME}>{row.time}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

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
