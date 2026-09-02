import { Loader2 } from "lucide-react";

import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";

type DashboardRouteLoadingProps = {
  label?: string;
};

/** Shared route-level loading shell for dashboard pages. */
export function DashboardRouteLoading({
  label = "Loading…",
}: DashboardRouteLoadingProps) {
  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <div
          className="flex min-h-[min(60vh,32rem)] flex-1 flex-col items-center justify-center gap-3 py-16"
          role="status"
          aria-live="polite"
          aria-label={label}
        >
          <Loader2
            className="size-9 shrink-0 animate-spin text-gray-400"
            aria-hidden
          />
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
