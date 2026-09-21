import { cn } from "@/lib/utils";

/** Pointer on interactive admin controls; not-allowed when disabled. */
export const adminInteractiveDisabledClass =
  "disabled:cursor-not-allowed disabled:opacity-60";

/** Text links in admin tables and copy. */
export const adminTextLinkClass =
  "cursor-pointer font-medium underline-offset-2 hover:underline";

/** Muted navigation links (back links, breadcrumbs). */
export const adminMutedLinkClass =
  "cursor-pointer inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900";

/** Sidebar and shell navigation links. */
export const adminNavLinkBaseClass =
  "cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40";

/** Segmented tab buttons (in-page toggles, not route links). */
export const adminSegmentedTabButtonClass =
  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

/** Primary filled action button used across admin pages. */
export const adminPrimaryButtonClass = cn(
  "inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800",
  adminInteractiveDisabledClass,
);

/** Secondary outline action button used across admin pages. */
export const adminSecondaryButtonClass = cn(
  "inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50",
  adminInteractiveDisabledClass,
);

/** Destructive outline action button. */
export const adminDestructiveButtonClass = cn(
  "inline-flex cursor-pointer items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50",
  adminInteractiveDisabledClass,
);

/** Icon-only menu trigger (e.g. row actions). */
export const adminIconButtonClass =
  "inline-flex cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0b1220]";

/** Clickable table row (whole row is the hit target). */
export const adminClickableTableRowClass =
  "cursor-pointer transition-colors hover:bg-gray-100/70";
