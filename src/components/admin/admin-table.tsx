/** Shared admin data-table styling (matches Customers page). */

import { cn } from "@/lib/utils";

export const adminTableClass = "w-full border-collapse text-left";

export const adminTableHeadClass =
  "sticky top-0 z-10 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm";

export const adminTableThClass =
  "px-5 py-3 text-xs font-medium tracking-wide text-gray-500 uppercase";

export const adminTableThDateClass = cn(
  adminTableThClass,
  "w-[1%] whitespace-nowrap",
);

export const adminTableTdClass = "px-5 py-3.5";

export const adminTableTdDateClass = cn(
  adminTableTdClass,
  "whitespace-nowrap text-sm tabular-nums text-gray-500",
);

export const adminTableRowClass = "hover:bg-gray-50/60";

export const adminTableEmptyClass =
  "px-5 py-16 text-center text-sm text-gray-500";

export function cellOrBlank(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

