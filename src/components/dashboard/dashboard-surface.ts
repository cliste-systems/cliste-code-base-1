/** Cliste mark fill — matches the logo asset in `public-assets.ts`. */
export const CLISTE_LOGO = "#353D42";

/** Sparingly used for primary actions and focused links. */
export const CLISTE_ACCENT = "#0b1220";

/**
 * Shared card surface — white with a defined edge and a soft, premium
 * elevation so cards read as real surfaces (not faint hairline outlines).
 */
export const DASHBOARD_CARD_SURFACE =
  "rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-28px_rgba(15,23,42,0.22)]";

/** Card variant that lifts on hover (metric tiles, clickable cards). */
export const DASHBOARD_CARD_INTERACTIVE =
  "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_50px_-26px_rgba(15,23,42,0.28)]";

/** Stacked form sections: one outer border, no grey gaps between blocks. */
export const DASHBOARD_FORM_STACK =
  "rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-28px_rgba(15,23,42,0.22)] divide-y divide-slate-100";

/** Nested route layouts under fill pages. */
export const DASHBOARD_VIEWPORT_LAYOUT =
  "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white";

/** Uppercase labels on cards and metrics. */
export const DASHBOARD_LABEL_CLASS =
  "font-medium uppercase tracking-[0.09em] text-slate-500";

/** Pointer on links, buttons, and other click targets across the dashboard. */
export const DASHBOARD_INTERACTIVE_CURSOR =
  "[&_a[href]:not([aria-disabled=true])]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_[role=button]:not([aria-disabled=true])]:cursor-pointer [&_summary]:cursor-pointer [&_label:has(input[type=checkbox])]:cursor-pointer [&_label:has(input[type=radio])]:cursor-pointer";

/** Scrollable dashboard pages — padding comes from `dashboard/layout.tsx`. */
export const DASHBOARD_PAGE_SHELL = "flex w-full flex-col space-y-6";

/** Home page — fills viewport; lists scroll inside bottom panels. */
export const DASHBOARD_PAGE_SHELL_FILL =
  "flex h-full min-h-0 w-full flex-col gap-4 bg-slate-50 p-4 sm:p-5 lg:px-8 lg:py-6";

/** Master/detail pages (Calls, Inbox) — white canvas, no grey gutters between cards. */
export const DASHBOARD_PAGE_SHELL_FILL_WHITE =
  "flex h-full min-h-0 w-full flex-col gap-4 bg-white p-4 sm:p-5 lg:px-8 lg:py-6";

/** Canonical home card — white, rounded, soft elevation. */
export const DASHBOARD_HOME_CARD =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-22px_rgba(15,23,42,0.30)] sm:p-5";

/** Rail + preview cards share the canonical card surface. */
export const DASHBOARD_HOME_RAIL_CARD = DASHBOARD_HOME_CARD;
export const DASHBOARD_HOME_PREVIEW_CARD = DASHBOARD_HOME_CARD;

/** Home Cara status — same elevation as preview cards, tighter padding. */
export const DASHBOARD_HOME_CARA_STATUS_CARD =
  "rounded-2xl border border-slate-200 bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-22px_rgba(15,23,42,0.30)] sm:px-3.5";

/** Home Needs attention — one card, Cliste logo tint (same shape as other home cards). */
export const DASHBOARD_HOME_ATTENTION_CARD =
  "rounded-2xl border border-[#353D42]/22 bg-[#353D42]/[0.07] p-4 shadow-[0_1px_2px_rgba(53,61,66,0.06),0_10px_30px_-22px_rgba(53,61,66,0.14)] sm:p-5";

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

/** @deprecated Use {@link DASHBOARD_ICON_CHIP_SM} — kept for home attention rows. */
export const DASHBOARD_HOME_ATTENTION_ICON_CHIP = DASHBOARD_ICON_CHIP_SM;

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

const ACCENT_CHIP_UNIFIED =
  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";

export const ACCENT_CHIP_CLASSES: Record<AccentTone, string> = {
  slate: ACCENT_CHIP_UNIFIED,
  indigo: ACCENT_CHIP_UNIFIED,
  emerald: ACCENT_CHIP_UNIFIED,
  amber: ACCENT_CHIP_UNIFIED,
  sky: ACCENT_CHIP_UNIFIED,
  violet: ACCENT_CHIP_UNIFIED,
  rose: ACCENT_CHIP_UNIFIED,
};
