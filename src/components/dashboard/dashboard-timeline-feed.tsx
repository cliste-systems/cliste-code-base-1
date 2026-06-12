import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Inbox,
  Phone,
  PhoneForwarded,
  PhoneMissed,
  Voicemail,
} from "lucide-react";

import { StatusPill } from "@/components/dashboard/status-pill";
import {
  DASHBOARD_HOME_ATTENTION_DIVIDER,
  DASHBOARD_ICON_CHIP_SM,
  DASHBOARD_ICON_GLYPH_SM,
  DASHBOARD_HOME_ATTENTION_ROW_HOVER,
  DASHBOARD_HOME_INSET_EMPTY,
  DASHBOARD_HOME_INSET_EMPTY_TIGHT,
  DASHBOARD_HOME_PREVIEW_EMPTY,
  type StatusVariant,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export type TimelineFeedRow = {
  id: string;
  href: string;
  time: string;
  title: string;
  /** Second line — e.g. what Cara captured (home Needs attention). */
  subtitle?: string;
  badge?: string;
  /** When true, badge reads as needing attention. */
  urgent?: boolean;
};

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export type HomePanelTone = "activity" | "attention";

/** Fixed-width outcome column so rows align in home lists. */
const HOME_PANEL_BADGE_CLASS =
  "h-5 min-w-[4.25rem] shrink-0 justify-center px-1.5 py-0 text-[10px] font-medium leading-none";

const HOME_PANEL_TIME_CLASS =
  "shrink-0 text-right text-[11px] leading-none tabular-nums text-slate-400";

function homePanelBadgeLabel(badge: string): string {
  const hay = badge.trim().toLowerCase();
  if (hay === "call answered") return "Answered";
  if (hay === "routed") return "Routed";
  if (hay === "callback requested") return "Callback";
  if (hay === "request captured") return "Request";
  if (hay === "missed call") return "Missed";
  if (hay === "voicemail") return "Voicemail";
  if (hay === "spam call") return "Spam";
  if (hay === "open") return "Open";
  return badge.trim();
}

function homePanelBadgeVariant(
  badge: string,
  tone: HomePanelTone,
  urgent?: boolean,
): StatusVariant {
  if (tone === "attention" || urgent) return "brand";
  const hay = badge.trim().toLowerCase();
  if (hay.includes("missed") || hay.includes("spam") || hay.includes("failed")) {
    return "muted";
  }
  return "neutral";
}

function homeFeedRowIcon(
  badge: string | undefined,
  urgent?: boolean,
): IconType {
  const label = badge?.trim().toLowerCase() ?? "";

  if (urgent || label === "open" || label.includes("request")) {
    return Inbox;
  }
  if (label.includes("routed")) {
    return ArrowUpRight;
  }
  if (label.includes("callback")) {
    return PhoneForwarded;
  }
  if (label.includes("missed") || label.includes("failed")) {
    return PhoneMissed;
  }
  if (label.includes("voicemail")) {
    return Voicemail;
  }
  if (label.includes("spam")) {
    return AlertCircle;
  }

  return Phone;
}

export type DashboardTimelineFeedEmptySize =
  | "default"
  | "activity"
  | "attention"
  | "preview"
  | "tight";

export function DashboardTimelineFeed({
  rows,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyBody,
  emptySize = "default",
  dense = false,
  homePanel = false,
  homePanelTone = "activity",
  fillPanel = false,
  className,
}: {
  rows: TimelineFeedRow[];
  emptyIcon: IconType;
  emptyTitle: string;
  emptyBody: string;
  /** Bounded empty layouts for the home dashboard. */
  emptySize?: DashboardTimelineFeedEmptySize;
  dense?: boolean;
  /** Home list panels — compact rows, shared styling. */
  homePanel?: boolean;
  /** Slight visual distinction between activity vs inbox on Home. */
  homePanelTone?: HomePanelTone;
  /** Let the list grow within the home panel without scrolling. */
  fillPanel?: boolean;
  className?: string;
}) {
  if (rows.length === 0) {
    const emptyShell =
      emptySize === "preview"
        ? DASHBOARD_HOME_PREVIEW_EMPTY
        : emptySize === "tight"
          ? DASHBOARD_HOME_INSET_EMPTY_TIGHT
          : DASHBOARD_HOME_INSET_EMPTY;

    const isTight = emptySize === "tight";
    const isPreview = emptySize === "preview";

    return (
      <div className={cn(emptyShell, className)}>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80",
            isTight || isPreview ? "size-8 rounded-xl" : "size-11",
          )}
        >
          <EmptyIcon
            className={isTight || isPreview ? "size-3.5" : "size-5"}
            aria-hidden
          />
        </span>
        {isTight ? (
          <div className="min-w-0 text-left">
            <p className="text-[13px] font-semibold text-[#0b1220]">{emptyTitle}</p>
            <p className="mt-0.5 max-w-xs text-[12px] leading-relaxed text-slate-500">
              {emptyBody}
            </p>
          </div>
        ) : (
          <>
            <p
              className={cn(
                "mt-3 font-semibold text-[#0b1220]",
                isPreview ? "text-[13px]" : "text-[15px]",
              )}
            >
              {emptyTitle}
            </p>
            <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-500">
              {emptyBody}
            </p>
          </>
        )}
      </div>
    );
  }

  if (homePanel) {
    const isAttention = homePanelTone === "attention";

    return (
      <ul
        className={cn(
          "px-1.5",
          fillPanel && "flex h-full min-h-0 flex-col",
          isAttention
            ? DASHBOARD_HOME_ATTENTION_DIVIDER
            : "divide-y divide-slate-100",
          className,
        )}
        role="list"
      >
        {rows.map((row) => {
          const RowIcon = homeFeedRowIcon(row.badge, row.urgent);

          const tone: HomePanelTone = isAttention ? "attention" : "activity";

          return (
            <li key={row.id}>
              <Link
                href={row.href}
                className={cn(
                  "group grid w-full grid-cols-[1.75rem_minmax(0,1fr)_4.25rem_minmax(4.5rem,auto)] items-center gap-x-2 rounded-lg py-1.5 transition-colors",
                  isAttention ? DASHBOARD_HOME_ATTENTION_ROW_HOVER : "hover:bg-slate-50/90",
                )}
              >
                <span
                  className={cn(
                    DASHBOARD_ICON_CHIP_SM,
                    row.subtitle && "self-start mt-0.5",
                  )}
                  aria-hidden
                >
                  <RowIcon className={DASHBOARD_ICON_GLYPH_SM} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium leading-snug text-[#0b1220]">
                    {row.title}
                  </span>
                  {row.subtitle ? (
                    <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-slate-500">
                      {row.subtitle}
                    </span>
                  ) : null}
                </span>
                {row.badge ? (
                  <StatusPill
                    variant={homePanelBadgeVariant(row.badge, tone, row.urgent)}
                    className={HOME_PANEL_BADGE_CLASS}
                  >
                    {homePanelBadgeLabel(row.badge)}
                  </StatusPill>
                ) : (
                  <span aria-hidden className="min-w-[4.25rem]" />
                )}
                <span
                  className={cn(
                    HOME_PANEL_TIME_CLASS,
                    row.subtitle && "self-start pt-0.5 leading-snug",
                  )}
                >
                  {row.time}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  const rowPadding = dense ? "px-0 py-1.5" : "gap-4 py-3";
  const timeClass = dense ? "text-[11px]" : "text-[12px]";
  const titleClass = dense ? "text-[13px]" : "text-[14px]";

  return (
    <ul className={cn("divide-y divide-slate-100", className)} role="list">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={row.href}
            className={cn(
              "group flex gap-3 transition-colors hover:bg-slate-50/80",
              !dense && "gap-4",
              rowPadding,
            )}
          >
            <span
              className={cn(
                "w-14 shrink-0 text-right leading-snug text-slate-400 tabular-nums",
                timeClass,
              )}
            >
              {row.time}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate font-medium leading-snug text-[#0b1220] group-hover:underline group-hover:underline-offset-2",
                  titleClass,
                )}
              >
                {row.title}
              </span>
              {row.badge ? (
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[11px] leading-snug",
                    row.urgent ? "font-medium text-slate-600" : "text-slate-500",
                  )}
                >
                  {row.badge}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
