import Link from "next/link";
import { Bell } from "lucide-react";

import { DashboardHeaderRangeControls } from "@/app/(dashboard)/dashboard/dashboard-header-range-controls";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";

export function DashboardHomeHeader({
  greeting,
  greetingSubline,
  openActions,
  caraActive,
}: {
  greeting: string;
  greetingSubline: string;
  openActions: number;
  caraActive: boolean;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[26px]">
          {greeting}
        </h1>
        <p className="mt-0.5 text-[13px] text-slate-500">{greetingSubline}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DashboardHeaderRangeControls caraActive={caraActive} />
        <Link
          href={DASHBOARD_ROUTES.actionInbox}
          className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-[#0b1220]"
          aria-label={
            openActions > 0
              ? `Open Action Inbox, ${openActions} open`
              : "Open Action Inbox"
          }
        >
          <Bell className="size-[18px]" aria-hidden />
          {openActions > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#0b1220] px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
              {formatNavBadgeCount(openActions)}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
