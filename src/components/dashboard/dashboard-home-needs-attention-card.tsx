"use client";

import { Inbox } from "lucide-react";

import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";
import {
  DashboardHomeFirstRowBody,
  DashboardHomeFirstRowButton,
  DashboardHomeFirstRowHeader,
  DashboardHomeFirstRowList,
  DashboardHomePanelEmptyState,
} from "@/components/dashboard/dashboard-home-first-row";
import { dashboardHomeCardShellClassName } from "@/components/dashboard/dashboard-surface";
import {
  dashboardFollowUpHubHref,
  dashboardFollowUpHubLabel,
} from "@/lib/dashboard-follow-up-hub";
import type { HomeRequestRow } from "@/lib/dashboard-home-requests";
import { DASHBOARD_HOME_INBOX_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";

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
      <DashboardHomeFirstRowHeader
        title={title}
        icon={Inbox}
        count={openActions}
        embedded={embedded}
      />

      <DashboardHomeFirstRowBody embedded={embedded}>
        {displayRows.length > 0 ? (
          embedded ? (
            <DashboardHomeFirstRowList
              embedded
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
            <>
              <DashboardHomeFirstRowList
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
              <DashboardHomeFirstRowButton href={followUpHref}>
                {followUpLabel}
              </DashboardHomeFirstRowButton>
            </>
          )
        ) : (
          <DashboardHomePanelEmptyState
            embedded={embedded}
            icon={Inbox}
            title="All clear"
            body="No callbacks, requests or follow-ups need the team right now."
          />
        )}
      </DashboardHomeFirstRowBody>
    </Shell>
  );
}
