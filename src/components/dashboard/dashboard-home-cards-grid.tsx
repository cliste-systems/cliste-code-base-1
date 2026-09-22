import { DashboardHomeCaraTrainingCard } from "@/components/dashboard/dashboard-home-cara-training-card";
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
  organizationId,
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
  organizationId: string;
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
  void callsToReview;
  void topTopics;
  void callsToReviewCount;
  void callTimes;

  return (
    <DashboardHomeResizeItem
      className={cn("hidden min-h-0 flex-1 lg:grid lg:grid-cols-3 lg:gap-4", className)}
    >
      <DashboardHomeLiveActivityCard
        activity={activity}
        organizationId={organizationId}
        className="h-full min-h-0"
        embedded
      />

      <DashboardHomeNeedsAttentionCard
        rows={needsAttention}
        openActions={openActions}
        title="Needs action"
        className="h-full min-h-0"
        embedded
      />

      <DashboardHomeCaraTrainingCard
        rows={caraTraining}
        openTrainingCount={openTrainingCount}
        className="h-full min-h-0"
        embedded
      />
    </DashboardHomeResizeItem>
  );
}
