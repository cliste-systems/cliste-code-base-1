import type { ReactNode } from "react";

import { DASHBOARD_FORM_STACK } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type DashboardScrollRegionProps = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
};

/** Stacked form sections inside one card — settings, legal docs, Cara setup. */
export function DashboardFormScrollRegion({
  children,
  className,
  scrollClassName,
}: DashboardScrollRegionProps) {
  return (
    <div
      data-debug-form-scroll-outer=""
      className={cn(
        DASHBOARD_FORM_STACK,
        "flex h-auto max-h-full min-h-0 w-full flex-col self-start overflow-hidden divide-y-0",
        className,
      )}
    >
      <div
        data-debug-form-scroll-inner=""
        className={cn(
          "min-h-0 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] divide-y divide-slate-100",
          scrollClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Scrollable area below a fixed header on card-based pages (Team, Locations).
 * Top/bottom rules stay pinned; no extra outer card shell.
 */
export function DashboardPageScrollBody({
  children,
  className,
  scrollClassName,
}: DashboardScrollRegionProps) {
  return (
    <div
      className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain border-t border-slate-200 [scrollbar-gutter:stable]",
          scrollClassName,
        )}
      >
        {children}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-slate-200"
        aria-hidden
      />
    </div>
  );
}
