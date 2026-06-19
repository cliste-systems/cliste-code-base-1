import {
  DashboardHomePanelOutlineLink,
} from "@/components/dashboard/dashboard-home-first-row";
import {
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import type { HomeUsageSnapshot } from "@/lib/dashboard-home-analytics";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export function DashboardHomeUsageCard({
  usage,
  className,
  embedded = false,
}: {
  usage: HomeUsageSnapshot;
  className?: string;
  embedded?: boolean;
}) {
  const allowanceLabel =
    usage.includedMinutes > 0
      ? `of ${usage.includedMinutes.toLocaleString("en-IE")} mins`
      : "this billing period";
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold tracking-tight text-[#0b1220]">
          Usage
        </h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          This month
        </span>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[11px] leading-none text-slate-500">Minutes used</p>
          <p className="mt-1 text-[20px] font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums">
            {usage.minutesUsed.toLocaleString("en-IE")}
          </p>
          <p className="mt-1 text-[10px] leading-none text-slate-500">
            {allowanceLabel}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-700"
              style={{ width: `${usage.progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] leading-none tabular-nums text-slate-500">
            {usage.progressPct}% used
          </p>
        </div>

        <div className="min-w-0 border-l border-slate-100 pl-3">
          <p className="text-[11px] leading-none text-slate-500">Remaining</p>
          <p className="mt-1 text-[20px] font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums">
            {usage.remainingMinutes.toLocaleString("en-IE")}
          </p>
          <p className="mt-1 text-[10px] leading-none text-slate-500">mins remaining</p>
        </div>
      </div>

      <div className="mt-auto shrink-0 pt-2">
        <DashboardHomePanelOutlineLink href={DASHBOARD_ROUTES.usage}>
          View usage
        </DashboardHomePanelOutlineLink>
      </div>
    </Shell>
  );
}
