import { DashboardHomeCallTimesCard } from "@/components/dashboard/dashboard-home-call-times-card";
import { DashboardHomeCaraTrainingCard } from "@/components/dashboard/dashboard-home-cara-training-card";
import { DashboardHomeCallOutcomesCard } from "@/components/dashboard/dashboard-home-call-outcomes-card";
import { DashboardHomeCaraPerformanceCard } from "@/components/dashboard/dashboard-home-cara-performance-card";
import { DashboardHomeFooterBanner } from "@/components/dashboard/dashboard-home-footer-banner";
import { DashboardHomeLiveActivityCard } from "@/components/dashboard/dashboard-home-live-activity-card";
import { DashboardHomeNeedsAttentionCard } from "@/components/dashboard/dashboard-home-needs-attention-card";
import { DashboardHomeRequestTypesCard } from "@/components/dashboard/dashboard-home-request-types-card";
import { DashboardHomeResizeItem } from "@/components/dashboard/dashboard-home-resize-motion";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { AnalyticsSegment } from "@/lib/dashboard-home-analytics";
import type { HomeCaraPerformanceSnapshot } from "@/lib/dashboard-home-cara-performance";
import type { HomeCallTimesBucket } from "@/lib/dashboard-home-call-times";
import type { HomeCaraTrainingRow, HomeRequestRow } from "@/lib/dashboard-home-requests";
import {
  DASHBOARD_HOME_ANALYTICS_ROW_HEIGHT_PX,
  DASHBOARD_HOME_FIRST_ROW_HEIGHT_PX,
} from "@/lib/dashboard-home-panel-limit";
import { cn } from "@/lib/utils";

export function DashboardHomeCardsGrid({
  activity,
  needsAttention,
  openActions,
  caraTraining,
  openTrainingCount,
  caraPerformance,
  requestTypeSegments,
  callOutcomeSegments,
  callTimes,
  className,
}: {
  activity: TimelineFeedRow[];
  needsAttention: HomeRequestRow[];
  openActions: number;
  caraTraining: HomeCaraTrainingRow[];
  openTrainingCount: number;
  caraPerformance: HomeCaraPerformanceSnapshot;
  requestTypeSegments: AnalyticsSegment[];
  callOutcomeSegments: AnalyticsSegment[];
  callTimes: HomeCallTimesBucket[];
  className?: string;
}) {
  return (
    <DashboardHomeResizeItem
      className={cn("hidden min-h-0 flex-1 flex-col gap-4 lg:flex", className)}
    >
      <DashboardHomeResizeItem
        className="grid shrink-0 grid-cols-3 items-stretch gap-4"
        style={{ minHeight: DASHBOARD_HOME_FIRST_ROW_HEIGHT_PX }}
      >
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeLiveActivityCard activity={activity} className="h-full" />
        </DashboardHomeResizeItem>
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeNeedsAttentionCard
            rows={needsAttention}
            openActions={openActions}
            className="h-full"
          />
        </DashboardHomeResizeItem>
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeCaraTrainingCard
            rows={caraTraining}
            openTrainingCount={openTrainingCount}
            className="h-full"
          />
        </DashboardHomeResizeItem>
      </DashboardHomeResizeItem>

      <DashboardHomeResizeItem
        className="grid shrink-0 grid-cols-4 gap-4"
        style={{ minHeight: DASHBOARD_HOME_ANALYTICS_ROW_HEIGHT_PX }}
      >
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeRequestTypesCard
            segments={requestTypeSegments}
            className="h-full min-h-0"
          />
        </DashboardHomeResizeItem>
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeCallOutcomesCard
            segments={callOutcomeSegments}
            className="h-full min-h-0"
          />
        </DashboardHomeResizeItem>
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeCaraPerformanceCard
            performance={caraPerformance}
            className="h-full min-h-0"
          />
        </DashboardHomeResizeItem>
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeCallTimesCard
            buckets={callTimes}
            className="h-full min-h-0"
          />
        </DashboardHomeResizeItem>
      </DashboardHomeResizeItem>

      <DashboardHomeResizeItem className="shrink-0">
        <DashboardHomeFooterBanner />
      </DashboardHomeResizeItem>
    </DashboardHomeResizeItem>
  );
}
