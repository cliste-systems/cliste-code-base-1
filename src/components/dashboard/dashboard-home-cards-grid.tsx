import { DashboardHomeCallTimesCard } from "@/components/dashboard/dashboard-home-call-times-card";
import { DashboardHomeCallsToReviewCard } from "@/components/dashboard/dashboard-home-calls-to-review-card";
import { DashboardHomeCaraTrainingCard } from "@/components/dashboard/dashboard-home-cara-training-card";
import { DashboardHomeLiveActivityCard } from "@/components/dashboard/dashboard-home-live-activity-card";
import { DashboardHomeNeedsAttentionCard } from "@/components/dashboard/dashboard-home-needs-attention-card";
import { DashboardHomeResizeItem } from "@/components/dashboard/dashboard-home-resize-motion";
import { DashboardHomeTopTopicsCard } from "@/components/dashboard/dashboard-home-top-topics-card";
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
        "hidden min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-rows-[minmax(0,1fr)_minmax(0,0.95fr)]",
        className,
      )}
    >
      <DashboardHomeResizeItem className="grid min-h-0 grid-cols-3 items-stretch gap-4">
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

      <DashboardHomeResizeItem className="grid min-h-0 grid-cols-3 items-stretch gap-4">
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeTopTopicsCard topics={topTopics} className="h-full" />
        </DashboardHomeResizeItem>
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeCallsToReviewCard
            rows={callsToReview}
            reviewCount={callsToReviewCount}
            className="h-full"
          />
        </DashboardHomeResizeItem>
        <DashboardHomeResizeItem className="h-full min-h-0 overflow-hidden">
          <DashboardHomeCallTimesCard buckets={callTimes} className="h-full min-h-0" />
        </DashboardHomeResizeItem>
      </DashboardHomeResizeItem>
    </DashboardHomeResizeItem>
  );
}
