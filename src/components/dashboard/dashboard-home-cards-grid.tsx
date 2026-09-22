import { DashboardHomeCaraTrainingCard } from "@/components/dashboard/dashboard-home-cara-training-card";
import { DashboardHomeInsightsCard } from "@/components/dashboard/dashboard-home-insights-card";
import { DashboardHomeLiveActivityCard } from "@/components/dashboard/dashboard-home-live-activity-card";
import { DashboardHomeNeedsAttentionCard } from "@/components/dashboard/dashboard-home-needs-attention-card";
import { DashboardHomeResizeItem } from "@/components/dashboard/dashboard-home-resize-motion";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { HomeCallReviewRow } from "@/lib/dashboard-home-calls-to-review";
import type { HomeCallTimesBucket } from "@/lib/dashboard-home-call-times";
import type { HomeCaraTrainingRow, HomeRequestRow } from "@/lib/dashboard-home-requests";
import type { HomeTopTopicRow } from "@/lib/dashboard-home-top-topics";
import { cn } from "@/lib/utils";

export function DashboardHomeCardsGrid({
  activity,
  needsAttention,
  openActions,
  caraTraining,
  openTrainingCount,
  topTopics,
  callsToReview,
  callsToReviewCount,
  callTimes,
  className,
}: {
  activity: TimelineFeedRow[];
  needsAttention: HomeRequestRow[];
  openActions: number;
  caraTraining: HomeCaraTrainingRow[];
  openTrainingCount: number;
  topTopics: HomeTopTopicRow[];
  callsToReview: HomeCallReviewRow[];
  callsToReviewCount: number;
  callTimes: HomeCallTimesBucket[];
  className?: string;
}) {
  return (
    <DashboardHomeResizeItem
      className={cn(
        "hidden min-h-0 flex-1 gap-4 lg:grid lg:grid-rows-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
        className,
      )}
    >
      <DashboardHomeResizeItem className="grid min-h-0 grid-cols-12 items-stretch gap-4">
        <DashboardHomeResizeItem className="col-span-7 h-full min-h-0 overflow-hidden">
          <DashboardHomeNeedsAttentionCard
            rows={needsAttention}
            openActions={openActions}
            className="h-full"
          />
        </DashboardHomeResizeItem>

        <DashboardHomeResizeItem className="col-span-5 h-full min-h-0 overflow-hidden">
          <DashboardHomeLiveActivityCard
            activity={activity}
            className="h-full"
          />
        </DashboardHomeResizeItem>
      </DashboardHomeResizeItem>

      <DashboardHomeResizeItem className="grid min-h-0 grid-cols-12 items-stretch gap-4">
        <DashboardHomeResizeItem className="col-span-7 h-full min-h-0 overflow-hidden">
          <DashboardHomeCaraTrainingCard
            rows={caraTraining}
            openTrainingCount={openTrainingCount}
            className="h-full"
          />
        </DashboardHomeResizeItem>

        <DashboardHomeResizeItem className="col-span-5 h-full min-h-0 overflow-hidden">
          <DashboardHomeInsightsCard
            topics={topTopics}
            callTimes={callTimes}
            callsToReview={callsToReview}
            callsToReviewCount={callsToReviewCount}
            className="h-full"
          />
        </DashboardHomeResizeItem>
      </DashboardHomeResizeItem>
    </DashboardHomeResizeItem>
  );
}
