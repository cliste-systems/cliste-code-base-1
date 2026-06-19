import { cn } from "@/lib/utils";

/**
 * Shared card surface — white with a defined edge and a soft, premium
 * elevation so cards read as real surfaces (not faint hairline outlines).
 */
export const DASHBOARD_CARD_SURFACE =
  "rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-28px_rgba(15,23,42,0.22)]";

/** Stacked form sections: one outer border, no grey gaps between blocks. */
export const DASHBOARD_FORM_STACK =
  "rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-28px_rgba(15,23,42,0.22)] divide-y divide-slate-100";

/** Nested route layouts under fill pages. */
export const DASHBOARD_VIEWPORT_LAYOUT =
  "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white";

/** Pointer on links, buttons, and other click targets across the dashboard. */
export const DASHBOARD_INTERACTIVE_CURSOR =
  "[&_a[href]:not([aria-disabled=true])]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_[role=button]:not([aria-disabled=true])]:cursor-pointer [&_summary]:cursor-pointer [&_label:has(input[type=checkbox])]:cursor-pointer [&_label:has(input[type=radio])]:cursor-pointer";

/** Master/detail pages (Calls, Inbox) — white canvas, no grey gutters between cards. */
export const DASHBOARD_PAGE_SHELL_FILL_WHITE =
  "flex h-full min-h-0 w-full flex-1 flex-col bg-white";

/** Viewport-fit home column — canonical dashboard gutter (px-8 pt-5 pb-5). */
export const DASHBOARD_HOME_CONTENT_COLUMN =
  "mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-1 flex-col gap-4 px-8 pb-5 pt-5";

/** Shared column — nav + page content share this wrapper so outer edges align. */
export const DASHBOARD_CONTENT_COLUMN =
  "mx-auto w-full max-w-[1500px] px-8";

/** Canonical home card — white, rounded, soft elevation. */
export const DASHBOARD_HOME_CARD =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-22px_rgba(15,23,42,0.30)] sm:p-5";

/** App canvas behind dashboard surfaces. */
export const DASHBOARD_SHELL_BG = "bg-white";

/** Desktop top navigation bar — single rounded container. */
export const DASHBOARD_TOP_NAV_SURFACE =
  "rounded-[24px] border border-[#e8eaed] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-22px_rgba(15,23,42,0.10)]";

/**
 * Hides dashboard page content and mobile nav while sections are rebuilt.
 * Desktop top nav stays visible. Set to false when re-enabling pages.
 */
export const DASHBOARD_REBUILD_SHELL = false;

/** Home hero — large rounded header block below desktop nav. */
export const DASHBOARD_HOME_HERO =
  "relative w-full rounded-[24px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-22px_rgba(15,23,42,0.08)]";

/** Home dashboard card shell — flex column, clip overflow when viewport is tight. */
export const DASHBOARD_HOME_CARD_BODY =
  "flex h-full min-h-0 flex-col overflow-hidden p-4";

/** Inner body when a home card sits inside a unified panel column. */
export const DASHBOARD_HOME_CARD_EMBEDDED_BODY =
  "flex h-full min-h-0 flex-col";

/** Unified home panel — one border/shadow wrapping multiple columns. */
export const DASHBOARD_HOME_UNIFIED_PANEL =
  `${DASHBOARD_CARD_SURFACE} min-h-0 overflow-hidden`;

export const DASHBOARD_HOME_UNIFIED_PANEL_COLUMN =
  "flex min-h-0 flex-col p-4";

export const DASHBOARD_HOME_UNIFIED_PANEL_GRID_OPS =
  "grid h-full min-h-0 grid-cols-3 divide-x divide-slate-100";

export const DASHBOARD_HOME_UNIFIED_PANEL_GRID_INSIGHTS =
  "grid h-full min-h-0 grid-cols-4 divide-x divide-slate-100";

export function dashboardHomeCardShellClassName(
  embedded: boolean,
  className?: string,
): string {
  return embedded
    ? cn(DASHBOARD_HOME_CARD_EMBEDDED_BODY, className)
    : cn(DASHBOARD_CARD_SURFACE, DASHBOARD_HOME_CARD_BODY, className);
}

/** Glass metrics row embedded in the home hero. */
export const DASHBOARD_HOME_HERO_STAT_STRIP =
  "rounded-[20px] border border-white/80 bg-white/75 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-4";

/** Inset surfaces inside the top nav — white pills on the white header bar. */
export const DASHBOARD_TOP_NAV_INSET =
  "border border-[#e8eaed] bg-white";

/** Compact pill controls inside the top nav (date, workspace, live status). */
export const DASHBOARD_TOP_NAV_PILL =
  "inline-flex h-9 items-center gap-2 rounded-full border border-[#e8eaed] bg-white px-3 text-[13px] font-medium text-[#0b1220] transition-colors hover:bg-slate-50";

/** Centre nav links inside the track — same hover as Today. */
export const DASHBOARD_TOP_NAV_ITEM =
  "relative inline-flex h-full items-center justify-center rounded-full px-6 text-[13px] font-medium transition-colors hover:bg-slate-50";

/** Centre nav group — Home, Calls, Inbox, Cara, More inside one rounded track. */
export const DASHBOARD_TOP_NAV_ITEMS =
  "flex h-10 shrink-0 flex-row flex-nowrap items-stretch gap-1 rounded-full border border-[#e8eaed] bg-white px-2 py-1";

/** Circular icon controls in the top nav (bell, avatar). */
export const DASHBOARD_TOP_NAV_ICON_BUTTON =
  "inline-flex size-9 items-center justify-center rounded-full border border-[#e8eaed] bg-white text-slate-600 transition-colors hover:bg-slate-50";

/**
 * Shared icon chip — border (not ring) so strokes are not clipped by overflow parents.
 * Use {@link DASHBOARD_ICON_GLYPH_*} on the Lucide icon inside each chip.
 */
export const DASHBOARD_ICON_CHIP_FILL =
  "overflow-visible border border-slate-200/80 bg-slate-100 text-slate-600";

/** Lucide size inside chips — inset from the chip edge so strokes are not clipped. */
export const DASHBOARD_ICON_GLYPH_SM = "size-3.5 shrink-0";
export const DASHBOARD_ICON_GLYPH_MD = "size-4 shrink-0";
export const DASHBOARD_ICON_GLYPH_LG = "size-5 shrink-0";

/** List rows, timeline feed, inbox queue rows. */
export const DASHBOARD_ICON_CHIP_SM =
  `flex size-7 shrink-0 items-center justify-center rounded-md p-1 ${DASHBOARD_ICON_CHIP_FILL}`;

/** Section cards and compact panels. */
export const DASHBOARD_ICON_CHIP_MD =
  `flex size-9 shrink-0 items-center justify-center rounded-xl p-1.5 ${DASHBOARD_ICON_CHIP_FILL}`;

/** Page headers (Calls, Inbox, Contacts). */
export const DASHBOARD_ICON_CHIP_LG =
  `flex size-10 shrink-0 items-center justify-center rounded-xl p-2 ${DASHBOARD_ICON_CHIP_FILL}`;

/** Call / contact list row avatar. */
export const DASHBOARD_ICON_CHIP_ROW =
  `flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl p-2 ${DASHBOARD_ICON_CHIP_FILL}`;

/** Large page header (Settings, Usage, Cara setup). */
export const DASHBOARD_ICON_CHIP_HEADER =
  `mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl p-2 ${DASHBOARD_ICON_CHIP_FILL}`;

export const DASHBOARD_HOME_ATTENTION_ROW_HOVER = "hover:bg-[#353D42]/[0.06]";

export const DASHBOARD_HOME_ATTENTION_DIVIDER = "divide-y divide-[#353D42]/12";

/** Centered empty state inside a home card. */
export const DASHBOARD_HOME_INSET_EMPTY =
  "flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-8 text-center";

/** Compact inline empty — single tidy row. */
export const DASHBOARD_HOME_INSET_EMPTY_TIGHT =
  "flex flex-row items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3 text-left";

/** Compact empty inside preview/chart cards. */
export const DASHBOARD_HOME_PREVIEW_EMPTY =
  "flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-6 text-center";

/** Home panel empty states — Recent activity, Needs attention, etc. */
export const DASHBOARD_HOME_PANEL_EMPTY_ICON =
  "mb-4 flex size-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm";

export const DASHBOARD_HOME_PANEL_EMPTY_TITLE =
  "text-[15px] font-semibold tracking-tight text-[#0b1220]";

export const DASHBOARD_HOME_PANEL_EMPTY_BODY =
  "mt-1.5 max-w-[16rem] text-[13px] leading-snug text-slate-500";

export const DASHBOARD_HOME_PANEL_EMPTY_ACTION =
  "mt-4 flex items-center gap-0.5 text-[13px] font-medium text-slate-600 transition-colors group-hover:text-[#0b1220]";

export const DASHBOARD_HOME_PANEL_EMPTY_INSET =
  "flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-6 text-center transition-colors hover:border-slate-300 hover:bg-slate-50/50";

/* ------------------------------------------------------------------ */
/* Type scale — one consistent ladder used across every page.          */
/* ------------------------------------------------------------------ */

export const DASHBOARD_EYEBROW_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";
export const DASHBOARD_TITLE_CLASS =
  "text-[26px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[28px]";
export const DASHBOARD_SECTION_TITLE_CLASS =
  "text-[15px] font-semibold tracking-tight text-[#0b1220]";
export const DASHBOARD_BODY_CLASS = "text-[14px] leading-relaxed text-slate-600";
export const DASHBOARD_HINT_CLASS = "text-[12.5px] leading-relaxed text-slate-500";

/* ------------------------------------------------------------------ */
/* Controls — higher-contrast inputs + one canonical primary button.   */
/* ------------------------------------------------------------------ */

/** Readable field chrome (stronger border + navy focus ring). */
export const DASHBOARD_INPUT_CLASS =
  "border-slate-300 bg-white focus-visible:border-[#0b1220] focus-visible:ring-1 focus-visible:ring-[#0b1220]";

/** Native <select> chrome that matches DASHBOARD_INPUT_CLASS. */
export const DASHBOARD_SELECT_CLASS =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[13px] text-slate-900 shadow-sm focus-visible:border-[#0b1220] focus-visible:ring-1 focus-visible:ring-[#0b1220] focus-visible:outline-none";

/** Home first-row card footers — soft grey, aligned with hero glass metrics. */
export const DASHBOARD_HOME_PANEL_ACTION_BUTTON_CLASS =
  "cursor-pointer rounded-xl border border-slate-200/80 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed";

/** The one primary CTA used everywhere. */
export const DASHBOARD_PRIMARY_BUTTON_CLASS =
  "h-10 cursor-pointer rounded-xl bg-[#0b1220] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0b1220]/90 disabled:cursor-not-allowed";

/** Quiet secondary button (outline). */
export const DASHBOARD_SECONDARY_BUTTON_CLASS =
  "h-10 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed";

/* ------------------------------------------------------------------ */
/* Status colours — quiet, meaning-only. Used for badges + checklist.  */
/* ------------------------------------------------------------------ */

export type StatusVariant =
  | "neutral"
  | "success"
  | "attention"
  | "info"
  | "muted"
  | "brand";

export const STATUS_BADGE_CLASSES: Record<StatusVariant, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  attention: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  muted: "border-slate-200 bg-white text-slate-500",
  brand: "border-[#353D42]/18 bg-[#353D42]/10 text-[#353D42]",
};

export const STATUS_DOT_CLASSES: Record<StatusVariant, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  attention: "bg-amber-500",
  info: "bg-sky-500",
  muted: "bg-slate-300",
  brand: "bg-[#353D42]",
};

/* ------------------------------------------------------------------ */
/* Section icon chips — single neutral tone (accent prop kept for API).  */
/* ------------------------------------------------------------------ */

export type AccentTone =
  | "slate"
  | "indigo"
  | "emerald"
  | "amber"
  | "sky"
  | "violet"
  | "rose";
