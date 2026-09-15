"use client";

import { Suspense } from "react";

import { DashboardDatePicker } from "@/components/dashboard/dashboard-date-picker";

type DashboardHeaderDateControlsProps = {
  /** Hero panel: lighter skeleton on silver gradient background. */
  variant?: "default" | "hero";
};

export function DashboardHeaderDateControls({
  variant = "default",
}: DashboardHeaderDateControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
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
        <DashboardDatePicker />
      </Suspense>
    </div>
  );
}
