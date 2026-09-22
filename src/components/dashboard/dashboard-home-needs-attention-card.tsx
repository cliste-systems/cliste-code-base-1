"use client";

import { Inbox } from "lucide-react";

import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";
import {
  DashboardHomeFirstRowButton,
  DashboardHomeFirstRowList,
  HOME_FIRST_ROW_COUNT_BADGE,
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
import {
  dashboardFollowUpHubHref,
  dashboardFollowUpHubLabel,
} from "@/lib/dashboard-follow-up-hub";
import type { HomeRequestRow } from "@/lib/dashboard-home-requests";
import { DASHBOARD_HOME_INBOX_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { cn } from "@/lib/utils";

function NeedsAttentionEmptyState() {
  return (
    <div className="flex min-h-0 flex-1 items-center rounded-lg border border-[#e3e9e5] bg-[#f6faf7] px-4 py-4">
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 mr-3 size-10")} aria-hidden>
        <Inbox className="size-5" />
      </div>
      <div className="min-w-0 text-left">
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[14px]")}>
          All clear
        </p>
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-0.5 max-w-none text-[12px]")}>
          No callbacks, requests or follow-ups need the team right now.
        </p>
      </div>
    </div>
  );
}

export function DashboardHomeNeedsAttentionCard({
  rows,
  openActions,
  title = "Needs attention",
  className,
  embedded = false,
}: {
  rows: HomeRequestRow[];
  openActions: number;
  title?: string;
  className?: string;
  embedded?: boolean;
}) {
  const { copy } = useDashboardVertical();
  const followUpHref = dashboardFollowUpHubHref(copy.vertical.id);
  const followUpLabel = dashboardFollowUpHubLabel(copy.vertical.id);
  const displayRows = rows.slice(0, DASHBOARD_HOME_INBOX_DISPLAY_LIMIT);
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <div className={HOME_FIRST_ROW_HEADER}>
        <h2 className={HOME_FIRST_ROW_TITLE}>{title}</h2>
        <span className={HOME_FIRST_ROW_COUNT_BADGE}>{openActions}</span>
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
            <DashboardHomeFirstRowButton href={followUpHref}>
              {followUpLabel}
            </DashboardHomeFirstRowButton>
          </div>
        </>
      ) : (
        <NeedsAttentionEmptyState />
      )}
    </Shell>
  );
}
