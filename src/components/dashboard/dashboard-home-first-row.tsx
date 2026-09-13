import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import {
  DASHBOARD_HOME_PANEL_ACTION_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

/** Shared layout tokens for the three first-row home cards. */

export const HOME_FIRST_ROW_HEADER =
  "mb-2.5 flex w-full shrink-0 items-center justify-between gap-2 border-b border-slate-100 pb-2";

export const HOME_FIRST_ROW_TITLE =
  "border-l-2 border-[#353D42] pl-2 text-[16px] font-semibold leading-none tracking-tight text-[#0b1220]";

export const HOME_FIRST_ROW_COUNT_BADGE =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold leading-none tabular-nums text-slate-600";

/** Header meta pill — matches count badge sizing (e.g. Live activity “Now”). */
export const HOME_FIRST_ROW_HEADER_META =
  "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium leading-none text-slate-600";

export const HOME_FIRST_ROW_LIST_ROW =
  "group grid w-full min-h-[3.25rem] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-2.5 transition-colors hover:bg-slate-50/80";

export const HOME_FIRST_ROW_LIST_TITLE =
  "block truncate text-[13px] font-medium leading-snug text-[#0b1220]";

export const HOME_FIRST_ROW_LIST_SUBTITLE =
  "mt-0.5 block truncate text-[11px] leading-snug text-slate-500";

export const HOME_FIRST_ROW_LIST_TIME =
  "shrink-0 pt-0.5 text-right text-[11px] leading-none tabular-nums text-slate-400 min-w-[3.25rem]";

/** List area — height follows row count (3 × 44px rows). */
export const HOME_FIRST_ROW_LIST = "shrink-0";

export const HOME_FIRST_ROW_FOOTER = "shrink-0 pt-1.5";

/** Empty body — equal height across Live activity, Needs attention, and Cara training. */
export const HOME_FIRST_ROW_EMPTY =
  "flex min-h-[7.5rem] flex-1 flex-col items-center justify-center px-2 py-6 text-center";

export const HOME_FIRST_ROW_ACTION_BUTTON = cn(
  DASHBOARD_HOME_PANEL_ACTION_BUTTON_CLASS,
  "group inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 text-[12px]",
);

export const HOME_PANEL_LINK_CHEVRON_CLASS =
  "size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-1";

export const HOME_PANEL_OUTLINE_LINK_CLASS = cn(
  DASHBOARD_SECONDARY_BUTTON_CLASS,
  "group inline-flex h-8 w-full shrink-0 items-center justify-center gap-1.5 px-3 text-[11px]",
);

function HomePanelLinkChevron() {
  return <ChevronRight className={HOME_PANEL_LINK_CHEVRON_CLASS} aria-hidden />;
}

export function DashboardHomeFirstRowButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={HOME_FIRST_ROW_ACTION_BUTTON}>
      {children}
      <HomePanelLinkChevron />
    </Link>
  );
}

export function DashboardHomePanelOutlineLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={HOME_PANEL_OUTLINE_LINK_CLASS}>
      {children}
      <HomePanelLinkChevron />
    </Link>
  );
}

export type DashboardHomeFirstRowListItem = {
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  time?: string | null;
};

export function DashboardHomeFirstRowList({
  rows,
}: {
  rows: DashboardHomeFirstRowListItem[];
}) {
  return (
    <ul className={cn(HOME_FIRST_ROW_LIST, "divide-y divide-slate-100")} role="list">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className={HOME_FIRST_ROW_LIST_ROW}>
            <span className="min-w-0">
              <span className={HOME_FIRST_ROW_LIST_TITLE}>{row.title}</span>
              {row.subtitle ? (
                <span className={HOME_FIRST_ROW_LIST_SUBTITLE}>{row.subtitle}</span>
              ) : null}
            </span>
            {row.time ? (
              <span className={HOME_FIRST_ROW_LIST_TIME}>{row.time}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
