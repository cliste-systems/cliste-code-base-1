import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  Clock3,
  MessageSquareText,
} from "lucide-react";

import {
  DASHBOARD_ICON_CHIP_SM,
  DASHBOARD_SECTION_TITLE_CLASS,
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import type { HomeCallReviewRow } from "@/lib/dashboard-home-calls-to-review";
import {
  homeCallTimesPeakLabel,
  homeCallTimesTotal,
  type HomeCallTimesBucket,
} from "@/lib/dashboard-home-call-times";
import type { HomeTopTopicRow } from "@/lib/dashboard-home-top-topics";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function insightValue(value: string) {
  return (
    <span className="text-[16px] font-semibold tracking-tight text-[#11181d]">
      {value}
    </span>
  );
}

export function DashboardHomeInsightsCard({
  topics,
  callTimes,
  callsToReview,
  callsToReviewCount,
  className,
}: {
  topics: HomeTopTopicRow[];
  callTimes: HomeCallTimesBucket[];
  callsToReview: HomeCallReviewRow[];
  callsToReviewCount: number;
  className?: string;
}) {
  const totalCalls = homeCallTimesTotal(callTimes);
  const peak = homeCallTimesPeakLabel(callTimes);
  const topTopic = topics[0] ?? null;
  const reviewHref = callsToReview[0]?.href ?? DASHBOARD_ROUTES.calls;

  return (
    <section className={dashboardHomeCardShellClassName(false, className)}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-[#e3e9e5] pb-2.5">
        <div>
          <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>Today&apos;s insights</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-[#6b7c75]">
            Patterns from today’s customer calls.
          </p>
        </div>
        <span className={DASHBOARD_ICON_CHIP_SM} aria-hidden>
          <BarChart3 className="size-3.5" />
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-4 gap-y-2">
        <div className="rounded-lg border border-[#e3e9e5] bg-[#f6faf7] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7c75]">
            <Clock3 className="size-3.5" aria-hidden />
            Busiest time
          </div>
          <div className="mt-1.5">
            {insightValue(peak ?? "Not enough data")}
          </div>
          <p className="mt-0.5 text-[11px] text-[#87958f]">
            {totalCalls > 0
              ? `${totalCalls} call${totalCalls === 1 ? "" : "s"} in this view`
              : "Appears once Cara has handled calls"}
          </p>
        </div>

        <div className="rounded-lg border border-[#e3e9e5] bg-[#f6faf7] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7c75]">
            <MessageSquareText className="size-3.5" aria-hidden />
            Top topic
          </div>
          <div className="mt-1.5 truncate">
            {insightValue(topTopic?.label ?? "No pattern yet")}
          </div>
          <p className="mt-0.5 text-[11px] text-[#87958f]">
            {topTopic
              ? `${topTopic.count} call${topTopic.count === 1 ? "" : "s"}`
              : "Builds from real call activity"}
          </p>
        </div>

        {callsToReviewCount > 0 ? (
          <Link
            href={reviewHref}
            className="group col-span-2 flex items-center justify-between gap-3 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] px-3 py-2.5 transition-colors hover:bg-white"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={cn(DASHBOARD_ICON_CHIP_SM, "size-8")}>
                <AlertCircle className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-[#11181d]">
                  {callsToReviewCount} call{callsToReviewCount === 1 ? "" : "s"} to review
                </span>
                <span className="block truncate text-[10.5px] text-[#6b7c75]">
                  Short hang-ups, incomplete calls or processing issues
                </span>
              </span>
            </span>
            <span className="text-[11px] font-medium text-[#4d5f58] transition-transform group-hover:translate-x-0.5">
              Open →
            </span>
          </Link>
        ) : (
          <div className="col-span-2 flex items-center gap-2.5 rounded-lg border border-[#e3e9e5] bg-[#fbfcfb] px-3 py-2.5">
            <span className={cn(DASHBOARD_ICON_CHIP_SM, "size-8")}>
              <AlertCircle className="size-3.5" aria-hidden />
            </span>
            <div>
              <p className="text-[12px] font-medium text-[#35443f]">
                No calls need review
              </p>
              <p className="text-[10.5px] text-[#87958f]">
                Only exceptions appear here.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 shrink-0 border-t border-[#e3e9e5] pt-2.5">
        <Link
          href={DASHBOARD_ROUTES.calls}
          className="inline-flex text-[11px] font-medium text-[#4d5f58] transition-colors hover:text-[#11181d]"
        >
          View call history →
        </Link>
      </div>
    </section>
  );
}
