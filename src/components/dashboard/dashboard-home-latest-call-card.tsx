import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  DASHBOARD_HOME_PREVIEW_EMPTY,
  DASHBOARD_HOME_RAIL_CARD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export type LatestCallPreview = {
  id: string;
  callerLabel: string;
  timeLabel: string;
  outcomeLabel: string;
  summary: string;
};

export function DashboardHomeLatestCallCard({
  latestCall,
}: {
  latestCall: LatestCallPreview | null;
}) {
  return (
    <article className={DASHBOARD_HOME_RAIL_CARD}>
      <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
        Latest call
      </h2>

      {latestCall ? (
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#0b1220]">
                {latestCall.callerLabel}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-500 tabular-nums">
                {latestCall.timeLabel}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-slate-500">
              {latestCall.outcomeLabel}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-slate-600">
            {latestCall.summary}
          </p>
          <Link
            href={`${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(latestCall.id)}`}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#0b1220] underline-offset-4 hover:underline"
          >
            Open call
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className={cn(DASHBOARD_HOME_PREVIEW_EMPTY, "mt-2")}>
          <p className="text-[13px] font-semibold text-[#0b1220]">No calls yet</p>
          <p className="mt-1 text-[12px] leading-snug text-slate-500">
            The latest call will appear here.
          </p>
        </div>
      )}
    </article>
  );
}
