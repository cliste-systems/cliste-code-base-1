"use client";

import { useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";

import {
  DashboardTimelineFeed,
  type TimelineFeedRow,
} from "@/components/dashboard/dashboard-timeline-feed";
import { useHomePanelRowCapacity } from "@/components/dashboard/use-home-panel-row-capacity";
import {
  DASHBOARD_HOME_ATTENTION_ROW_HEIGHT_PX,
  DASHBOARD_HOME_LIST_ROW_HEIGHT_PX,
  DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
} from "@/lib/dashboard-home-panel-limit";
import { cn } from "@/lib/utils";

export function DashboardHomeFilledFeed({
  rows,
  homePanelTone,
  maxRows = DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
  emptyIcon,
  emptyTitle,
  emptyBody,
  className,
}: {
  rows: TimelineFeedRow[];
  homePanelTone: "activity" | "attention";
  maxRows?: number;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  className?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowHeightPx =
    homePanelTone === "attention"
      ? DASHBOARD_HOME_ATTENTION_ROW_HEIGHT_PX
      : DASHBOARD_HOME_LIST_ROW_HEIGHT_PX;

  const capacity = useHomePanelRowCapacity(
    bodyRef,
    rows.length,
    maxRows,
    false,
    rowHeightPx,
  );

  const displayRows = useMemo(
    () => rows.slice(0, capacity || rows.length),
    [capacity, rows],
  );

  const hasRows = displayRows.length > 0;

  return (
    <div
      ref={bodyRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {hasRows ? (
        <DashboardTimelineFeed
          dense
          homePanel
          fillPanel
          homePanelTone={homePanelTone}
          rows={displayRows}
          emptyIcon={emptyIcon}
          emptyTitle={emptyTitle}
          emptyBody={emptyBody}
          className="h-full min-h-0"
        />
      ) : null}
    </div>
  );
}
