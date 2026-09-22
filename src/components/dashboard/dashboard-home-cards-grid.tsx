import Link from "next/link";
import { AlertCircle, Clock3, MessageSquareText } from "lucide-react";

import { DashboardHomeCaraTrainingCard } from "@/components/dashboard/dashboard-home-cara-training-card";
import { DashboardHomeLiveActivityCard } from "@/components/dashboard/dashboard-home-live-activity-card";
import { DashboardHomeNeedsAttentionCard } from "@/components/dashboard/dashboard-home-needs-attention-card";
import { DashboardHomeResizeItem } from "@/components/dashboard/dashboard-home-resize-motion";
import {
  DASHBOARD_HOME_UNIFIED_PANEL,
} from "@/components/dashboard/dashboard-surface";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { HomeCallReviewRow } from "@/lib/dashboard-home-calls-to-review";
import {
  homeCallTimesPeakLabel,
  homeCallTimesTotal,
  type HomeCallTimesBucket,
} from "@/lib/dashboard-home-call-times";
import type { HomeCaraTrainingRow, HomeRequestRow } from "@/lib/dashboard-home-requests";
import type { HomeTopTopicRow } from "@/lib/dashboard-home-top-topics";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function DashboardHomeAtAGlance({
  topTopics,
  callsToReviewCount,
  callTimes,
}: {
  topTopics: HomeTopTopicRow[];
  callsToReviewCount: number;
  callTimes: HomeCallTimesBucket[];
}) {
  const totalCalls = homeCallTimesTotal(callTimes);
  const peak = homeCallTimesPeakLabel(callTimes);
  const topTopic = topTopics[0] ?? null;

  return (
    <div className="min-h-0">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[#11181d]">
            Today at a glance
          </h2>
          <p className="mt-0.5 text-[11px] text-[#6b7c75]">
            Useful patterns from customer calls.
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#e3e9e5] border-y border-[#e3e9e5]">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
          <span className="flex items-center gap-2 text-[12px] text-[#5b6b65]">
            <Clock3 className="size-3.5 text-[#6b7c75]" aria-hidden />
            Busiest time
          </span>
          <span className="text-[12px] font-medium text-[#11181d]">
            {peak ?? (totalCalls > 0 ? "Building pattern" : "No calls yet")}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
          <span className="flex items-center gap-2 text-[12px] text-[#5b6b65]">
            <MessageSquareText className="size-3.5 text-[#6b7c75]" aria-hidden />
            Top topic
          </span>
          <span className="max-w-[13rem] truncate text-[12px] font-medium text-[#11181d]">
            {topTopic?.label ?? "No pattern yet"}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
          <span className="flex items-center gap-2 text-[12px] text-[#5b6b65]">
            <AlertCircle className="size-3.5 text-[#6b7c75]" aria-hidden />
            Calls to review
          </span>
          <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-[#d9e2dd] bg-[#f6faf7] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#4d5f58]">
            {callsToReviewCount}
          </span>
        </div>
      </div>

      <Link
        href={DASHBOARD_ROUTES.calls}
        className="mt-2.5 inline-flex text-[11px] font-medium text-[#4d5f58] transition-colors hover:text-[#11181d]"
      >
        View call history →
      </Link>
    </div>
  );
}

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
  void callsToReview;

  return (
    <DashboardHomeResizeItem
      className={cn("hidden min-h-0 flex-1 lg:block", className)}
    >
      <section className={cn(DASHBOARD_HOME_UNIFIED_PANEL, "grid h-full grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]")}>
        <div className="grid min-h-0 grid-rows-[minmax(0,1.05fr)_minmax(0,0.95fr)] divide-y divide-[#e3e9e5]">
          <div className="min-h-0 p-4">
            <DashboardHomeNeedsAttentionCard
              rows={needsAttention}
              openActions={openActions}
              title="Needs action"
              className="h-full"
              embedded
            />
          </div>

          <div className="min-h-0 p-4">
            <DashboardHomeCaraTrainingCard
              rows={caraTraining}
              openTrainingCount={openTrainingCount}
              className="h-full"
              embedded
            />
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] border-l border-[#e3e9e5]">
          <div className="min-h-0 p-4">
            <DashboardHomeLiveActivityCard
              activity={activity}
              className="h-full"
              embedded
            />
          </div>

          <div className="border-t border-[#e3e9e5] bg-[#fafcfb] p-4">
            <DashboardHomeAtAGlance
              topTopics={topTopics}
              callsToReviewCount={callsToReviewCount}
              callTimes={callTimes}
            />
          </div>
        </div>
      </section>
    </DashboardHomeResizeItem>
  );
}
