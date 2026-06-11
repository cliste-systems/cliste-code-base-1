"use client";

import { Suspense } from "react";

import { DashboardCaraActiveToggle } from "./dashboard-cara-active-toggle";
import { DashboardMetricRangeToggle } from "./dashboard-metric-range-toggle";

type DashboardHeaderRangeControlsProps = {
  caraActive: boolean;
  /** Hero panel: lighter pills on silver gradient background. */
  variant?: "default" | "hero";
};

export function DashboardHeaderRangeControls({
  caraActive,
  variant = "default",
}: DashboardHeaderRangeControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <DashboardCaraActiveToggle initialActive={caraActive} variant={variant} />
      <Suspense
        fallback={
          <div
            className={
              variant === "hero"
                ? "h-9 w-52 animate-pulse rounded-full bg-white/60"
                : "h-[42px] w-52 animate-pulse rounded-full bg-slate-100"
            }
          />
        }
      >
        <DashboardMetricRangeToggle variant={variant} />
      </Suspense>
    </div>
  );
}
