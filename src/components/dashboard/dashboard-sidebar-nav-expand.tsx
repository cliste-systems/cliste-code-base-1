"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardSidebarNavExpandProps = {
  expanded: boolean;
  children: ReactNode;
};

/**
 * Height expand without opacity animation — avoids clipped rings and flicker
 * when the parent section re-opens after a toggle on the active route.
 */
export function DashboardSidebarNavExpand({
  expanded,
  children,
}: DashboardSidebarNavExpandProps) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      aria-hidden={!expanded}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="space-y-0.5 pt-0.5">{children}</div>
      </div>
    </div>
  );
}

export const DASHBOARD_SIDEBAR_CHEVRON_CLASS =
  "size-4 shrink-0 text-slate-400 transition-transform duration-200 ease-out";
