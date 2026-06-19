import { Clock } from "lucide-react";

import { DashboardHomePanelOutlineLink } from "@/components/dashboard/dashboard-home-first-row";
import {
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import {
  homeCallTimesPeakLabel,
  homeCallTimesReadyForChart,
  homeCallTimesTotal,
  type HomeCallTimesBucket,
} from "@/lib/dashboard-home-call-times";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function CallTimesEmptyState() {
  return (
    <div className="flex flex-1 items-center gap-2.5">
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 size-9")} aria-hidden>
        <Clock className="size-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[13px]")}>
          No call pattern yet
        </p>
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-0.5 max-w-none text-[11px]")}>
          Busiest hours will appear once Cara starts taking calls.
        </p>
      </div>
    </div>
  );
}

function CallTimesInsufficientState({
  total,
  peak,
}: {
  total: number;
  peak: string | null;
}) {
  return (
    <div className="flex flex-1 items-center gap-2.5">
      <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 size-9")} aria-hidden>
        <Clock className="size-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[13px]")}>
          Not enough data yet
        </p>
        <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_BODY, "mt-0.5 max-w-none text-[11px]")}>
          {total === 1
            ? "1 call today"
            : `${total} calls today`}
          {peak ? ` · busiest at ${peak}` : ""}
          . A clearer hourly pattern appears after more calls.
        </p>
      </div>
    </div>
  );
}

function CallTimesChart({ buckets }: { buckets: HomeCallTimesBucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);

  return (
    <div
      className="flex min-h-0 flex-1 items-end gap-0.5 overflow-hidden pt-1"
      role="img"
      aria-label="Call volume by hour"
    >
        {buckets.map((bucket) => {
          const heightPct = Math.round((bucket.value / max) * 100);
          return (
            <div
              key={bucket.id}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <div className="flex h-14 w-full items-end">
                <div
                  className={cn(
                    "w-full rounded-t-[3px] bg-slate-700 transition-[height]",
                    bucket.value <= 0 && "bg-slate-200",
                  )}
                  style={{
                    height: `${Math.max(heightPct, bucket.value > 0 ? 8 : 0)}%`,
                  }}
                  title={`${bucket.label}: ${bucket.value} calls`}
                />
              </div>
              <span className="w-full truncate text-center text-[9px] leading-none tabular-nums text-slate-500">
                {bucket.label}
              </span>
            </div>
          );
        })}
    </div>
  );
}

export function DashboardHomeCallTimesCard({
  buckets,
  className,
  embedded = false,
}: {
  buckets: HomeCallTimesBucket[];
  className?: string;
  embedded?: boolean;
}) {
  const total = homeCallTimesTotal(buckets);
  const peak = homeCallTimesPeakLabel(buckets);
  const showChart = homeCallTimesReadyForChart(buckets);
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <h2 className="mb-2 shrink-0 text-[14px] font-semibold tracking-tight text-[#0b1220]">
        Call times
      </h2>

      {peak && showChart ? (
        <p className="mb-2 shrink-0 text-[11px] leading-none text-slate-500">
          Peak: <span className="font-medium text-[#0b1220]">{peak}</span>
        </p>
      ) : null}

      {total <= 0 ? (
        <CallTimesEmptyState />
      ) : showChart ? (
        <CallTimesChart buckets={buckets} />
      ) : (
        <CallTimesInsufficientState total={total} peak={peak} />
      )}

      <div className="mt-auto shrink-0 pt-2">
        <DashboardHomePanelOutlineLink href={DASHBOARD_ROUTES.calls}>
          View call history
        </DashboardHomePanelOutlineLink>
      </div>
    </Shell>
  );
}
