import { cn } from "@/lib/utils";

/** Shared with workspace nav rows in dashboard-sidebar.tsx */
export const DASHBOARD_SIDEBAR_ROW_BASE =
  "group relative flex h-11 items-center justify-between gap-2 rounded-xl border px-3 text-[13px] transition-colors";

export const DASHBOARD_SIDEBAR_ROW_ACTIVE =
  "border-slate-200 bg-white font-semibold text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-14px_rgba(15,23,42,0.25)] before:absolute before:top-1/2 before:left-0 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#353D42]";

export const DASHBOARD_SIDEBAR_ROW_IDLE =
  "border-transparent font-normal text-slate-500 hover:bg-white/70 hover:text-[#0b1220]";

export const DASHBOARD_SIDEBAR_SUB_ROW_BASE =
  "group relative flex h-10 items-center justify-between gap-2 rounded-xl border pl-9 pr-3 text-[12.5px] transition-colors";

export function dashboardSidebarRowClassName(active: boolean): string {
  return cn(
    DASHBOARD_SIDEBAR_ROW_BASE,
    active ? DASHBOARD_SIDEBAR_ROW_ACTIVE : DASHBOARD_SIDEBAR_ROW_IDLE,
  );
}

export function dashboardSidebarSubRowClassName(active: boolean): string {
  return cn(
    DASHBOARD_SIDEBAR_SUB_ROW_BASE,
    active ? DASHBOARD_SIDEBAR_ROW_ACTIVE : DASHBOARD_SIDEBAR_ROW_IDLE,
  );
}

export function dashboardSidebarHeaderClassName(onSectionRoute: boolean): string {
  return cn(
    DASHBOARD_SIDEBAR_ROW_BASE,
    "w-full border-transparent text-left hover:bg-white/70 hover:text-[#0b1220]",
    onSectionRoute
      ? "font-semibold text-[#0b1220]"
      : "font-normal text-slate-500",
  );
}

/** @deprecated Outer section boxes removed — keep flat list like workspace nav. */
export function dashboardSidebarGroupClassName(): string {
  return "space-y-0.5";
}
