/** Shared admin data-table styling (matches Customers page). */

import { cn } from "@/lib/utils";

/** Fluid table — no horizontal scroll; columns share viewport width. */
export const adminTableClass = "w-full table-fixed border-collapse text-left text-sm";

export const adminTableHeadClass =
  "sticky top-0 z-10 border-b border-gray-200 bg-gray-50";

export const adminTableThClass =
  "px-4 py-2.5 text-left text-[11px] font-semibold tracking-normal text-gray-500";

export const adminTableThDateClass = cn(
  adminTableThClass,
  "w-[14%] whitespace-nowrap text-right",
);

export const adminTableThActionsClass = cn(
  adminTableThClass,
  "w-[8%] text-right",
);

export const adminTableBodyClass =
  "[&_tr:nth-child(even)]:bg-gray-50/50 [&_tr]:border-b [&_tr]:border-gray-100 [&_tr:last-child]:border-0";

export const adminTableTdClass = "px-4 py-2 align-middle";

export const adminTableTdTruncateClass = cn(adminTableTdClass, "max-w-0 truncate");

export const adminTableTdDateClass = cn(
  adminTableTdClass,
  "whitespace-nowrap text-right text-sm tabular-nums text-gray-500",
);

export const adminTableRowClass =
  "transition-colors hover:bg-gray-100/70";

export const adminTableEmptyClass =
  "px-4 py-16 text-center text-sm text-gray-500";

export function cellOrBlank(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function adminTableThWidth(width: string): string {
  return cn(adminTableThClass, width);
}

export function adminTableThWidthRight(width: string): string {
  return cn(adminTableThClass, width, "text-right");
}
