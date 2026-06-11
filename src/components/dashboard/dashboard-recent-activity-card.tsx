"use client";

import { Activity, PhoneCall } from "lucide-react";

import { DashboardSectionLink } from "@/components/dashboard/dashboard-editorial-section";
import { DashboardHomeFilledFeed } from "@/components/dashboard/dashboard-home-filled-feed";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  DASHBOARD_HOME_CARD,
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function RecentActivityEmptyState() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-4 py-6 text-center">
      <div className={DASHBOARD_HOME_PANEL_EMPTY_ICON} aria-hidden>
        <Activity className="size-6" />
      </div>
      <p className={DASHBOARD_HOME_PANEL_EMPTY_TITLE}>No activity yet</p>
      <p className={DASHBOARD_HOME_PANEL_EMPTY_BODY}>
        Calls, requests and actions will appear here once Cara is live.
      </p>
    </div>
  );
}

export function RecentActivityCard({
  activity,
  className,
}: {
  activity: TimelineFeedRow[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        DASHBOARD_HOME_CARD,
        "flex h-full min-h-0 flex-col",
        className,
      )}
    >
      <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
          Recent activity
        </h2>
        {activity.length > 0 ? (
          <DashboardSectionLink href={DASHBOARD_ROUTES.calls}>
            View all
          </DashboardSectionLink>
        ) : null}
      </div>

      {activity.length > 0 ? (
        <DashboardHomeFilledFeed
          rows={activity}
          homePanelTone="activity"
          maxRows={DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT}
          emptyIcon={PhoneCall}
          emptyTitle="No activity yet"
          emptyBody=""
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <RecentActivityEmptyState />
        </div>
      )}
    </section>
  );
}
