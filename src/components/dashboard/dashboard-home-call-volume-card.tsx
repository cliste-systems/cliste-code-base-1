import Link from "next/link";

import { DashboardCallVolumeChart } from "@/components/dashboard/dashboard-call-volume-chart";
import {
  buildCallActivitySeries,
  selectCallVolumeChartPoints,
} from "@/lib/dashboard-call-activity-series";
import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { DASHBOARD_HOME_CARD } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export function DashboardHomeCallVolumeCard({
  range,
  callTimestampsIso,
  callsAnswered,
  className,
}: {
  range: DashboardMetricRangeKey;
  callTimestampsIso: string[];
  callsAnswered: number;
  className?: string;
}) {
  const points = selectCallVolumeChartPoints(
    range,
    buildCallActivitySeries(range, callTimestampsIso),
  );
  const hasData = callsAnswered > 0;

  return (
    <article className={cn(DASHBOARD_HOME_CARD, "flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Call volume
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">
            Calls handled over the selected period.
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-3">
          {hasData ? (
            <span className="text-[22px] font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums">
              {callsAnswered}
            </span>
          ) : null}
          <Link
            href={DASHBOARD_ROUTES.calls}
            className="text-[13px] font-medium text-slate-600 underline-offset-4 transition-colors hover:text-[#0b1220] hover:underline"
          >
            View calls
          </Link>
        </div>
      </div>

      <div className="mt-4 h-[240px] flex-1 sm:h-[260px]">
        {hasData ? (
          <DashboardCallVolumeChart points={points} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
            <p className="text-[14px] font-semibold text-[#0b1220]">No calls yet</p>
            <p className="mt-1 max-w-[280px] text-[12.5px] leading-snug text-slate-500">
              Your call volume will chart here once Cara starts answering on your
              line.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
