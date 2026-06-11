import type { OutcomeMixRow } from "@/lib/dashboard-home-outcome-mix";
import {
  DASHBOARD_HOME_PREVIEW_EMPTY,
  DASHBOARD_HOME_RAIL_CARD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export function DashboardHomeOutcomeMixCard({
  rows,
  totalCalls,
}: {
  rows: OutcomeMixRow[];
  totalCalls: number;
}) {
  const hasData = totalCalls > 0;
  const visibleRows = hasData ? rows.filter((r) => r.count > 0) : rows;
  const maxCount = Math.max(1, ...visibleRows.map((r) => r.count));

  return (
    <article className={DASHBOARD_HOME_RAIL_CARD}>
      <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
        Outcome mix
      </h2>
      <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
        How calls ended in this period.
      </p>

      {hasData ? (
        <ul className="mt-2 space-y-1.5">
          {visibleRows.map((row) => (
            <li key={row.id}>
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate text-slate-600">{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-[#0b1220]">
                  {row.count}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-400/80"
                  style={{
                    width: `${Math.round((row.count / maxCount) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={cn(DASHBOARD_HOME_PREVIEW_EMPTY, "mt-2")}>
          <p className="text-[13px] font-semibold text-[#0b1220]">
            No outcomes yet
          </p>
          <p className="mt-1 text-[12px] leading-snug text-slate-500">
            Outcomes will appear once calls are handled on your line.
          </p>
        </div>
      )}
    </article>
  );
}
