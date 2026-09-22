"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";

import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  DashboardHomeFirstRowBody,
  DashboardHomeFirstRowButton,
  DashboardHomeFirstRowHeader,
  DashboardHomeFirstRowList,
  DashboardHomePanelEmptyState,
} from "@/components/dashboard/dashboard-home-first-row";
import { dashboardHomeCardShellClassName } from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { DASHBOARD_HOME_LIVE_ACTIVITY_DISPLAY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import {
  activityRowsToCallRefs,
  mergeHomeActivityWithIncomingCalls,
} from "@/lib/home-incoming-call-activity";
import { useHomeLiveIncomingCalls } from "@/lib/use-home-live-incoming-calls";

export function DashboardHomeLiveActivityCard({
  activity,
  organizationId,
  className,
  embedded = false,
}: {
  activity: TimelineFeedRow[];
  organizationId: string;
  className?: string;
  embedded?: boolean;
}) {
  const activityCalls = useMemo(() => activityRowsToCallRefs(activity), [activity]);
  const incomingCalls = useHomeLiveIncomingCalls({
    organizationId,
    activityCalls,
  });
  const rows = mergeHomeActivityWithIncomingCalls(
    activity,
    incomingCalls,
    DASHBOARD_HOME_LIVE_ACTIVITY_DISPLAY_LIMIT,
  );
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <DashboardHomeFirstRowHeader
        title="Recent activity"
        icon={Activity}
        count={activity.length}
        embedded={embedded}
      />

      <DashboardHomeFirstRowBody embedded={embedded}>
        {rows.length > 0 ? (
          embedded ? (
            <DashboardHomeFirstRowList
              embedded
              showCallIcons
              rows={rows.map((row) => ({
                id: row.id,
                href: row.href,
                title: row.title,
                subtitle: row.subtitle,
                time: row.time,
                liveCall: row.liveCall,
              }))}
            />
          ) : (
            <>
              <DashboardHomeFirstRowList
                showCallIcons
                rows={rows.map((row) => ({
                  id: row.id,
                  href: row.href,
                  title: row.title,
                  subtitle: row.subtitle,
                  time: row.time,
                  liveCall: row.liveCall,
                }))}
              />
              <DashboardHomeFirstRowButton href={DASHBOARD_ROUTES.activity}>
                View all activity
              </DashboardHomeFirstRowButton>
            </>
          )
        ) : (
          <DashboardHomePanelEmptyState
            embedded={embedded}
            icon={Activity}
            title="No customer activity yet"
            body="Recent customer calls will appear here."
          />
        )}
      </DashboardHomeFirstRowBody>
    </Shell>
  );
}
