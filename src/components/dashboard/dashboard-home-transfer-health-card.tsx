import { PhoneForwarded } from "lucide-react";

import { DashboardHomePanelOutlineLink } from "@/components/dashboard/dashboard-home-first-row";
import {
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
  dashboardHomeCardShellClassName,
} from "@/components/dashboard/dashboard-surface";
import type { TransferHealthSnapshot } from "@/lib/dashboard-home-analytics";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export function DashboardHomeTransferHealthCard({
  transferHealth,
  className,
  embedded = false,
}: {
  transferHealth: TransferHealthSnapshot;
  className?: string;
  embedded?: boolean;
}) {
  const { attempted, connected, connectionRate } = transferHealth;
  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={dashboardHomeCardShellClassName(embedded, className)}>
      <h2 className="mb-2 shrink-0 text-[14px] font-semibold tracking-tight text-[#0b1220]">
        Transfer health
      </h2>

      {attempted > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] text-slate-500">Attempted</p>
              <p className="text-[20px] font-semibold tabular-nums text-[#0b1220]">
                {attempted}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] text-slate-500">Connected</p>
              <p className="text-[20px] font-semibold tabular-nums text-[#0b1220]">
                {connected}
              </p>
            </div>
          </div>
          <p className="text-[12px] text-slate-600">
            {connectionRate == null
              ? "No successful connects recorded yet."
              : `${connectionRate}% of transfer attempts reached a person.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2.5">
          <div className={cn(DASHBOARD_HOME_PANEL_EMPTY_ICON, "mb-0 size-9")} aria-hidden>
            <PhoneForwarded className="size-4" />
          </div>
          <div className="min-w-0 text-left">
            <p className={cn(DASHBOARD_HOME_PANEL_EMPTY_TITLE, "text-[13px]")}>
              No transfers yet
            </p>
            <p
              className={cn(
                DASHBOARD_HOME_PANEL_EMPTY_BODY,
                "mt-0.5 max-w-none text-[11px]",
              )}
            >
              Attempted vs connected counts appear once Cara tries live transfers.
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto shrink-0 pt-2">
        <DashboardHomePanelOutlineLink href={DASHBOARD_ROUTES.phoneSetup}>
          View phone setup
        </DashboardHomePanelOutlineLink>
      </div>
    </Shell>
  );
}
