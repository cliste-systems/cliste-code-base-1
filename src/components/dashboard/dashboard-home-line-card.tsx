import { StatusPill } from "@/components/dashboard/status-pill";
import type { CaraStatusSnapshot } from "@/lib/cara-status";
import { DASHBOARD_HOME_RAIL_CARD } from "@/components/dashboard/dashboard-surface";

export function DashboardHomeLineCard({
  periodPhrase,
  caraStatus,
}: {
  periodPhrase: string;
  caraStatus: CaraStatusSnapshot;
}) {
  const lineLive = caraStatus.liveStatus.value === "Live";
  const phoneConnected = caraStatus.phoneLine.value === "Connected";

  return (
    <article className={DASHBOARD_HOME_RAIL_CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Your line
          </h2>
          <p className="mt-0.5 text-[12px] capitalize text-slate-500">
            {periodPhrase}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <StatusPill variant={lineLive ? "success" : "attention"}>
            {caraStatus.liveStatus.value}
          </StatusPill>
          <StatusPill variant={phoneConnected ? "success" : "neutral"}>
            {caraStatus.phoneLine.value}
          </StatusPill>
        </div>
      </div>

      <p className="mt-2 text-[13px] leading-snug text-slate-600">
        {caraStatus.liveStatus.subtext}
      </p>
      {phoneConnected ? (
        <p className="mt-1 text-[13px] font-medium tabular-nums text-[#0b1220]">
          {caraStatus.phoneLine.subtext}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-slate-500">
          {caraStatus.phoneLine.subtext}
        </p>
      )}
    </article>
  );
}
