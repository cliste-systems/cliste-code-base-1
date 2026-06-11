import type { ComponentType, ReactNode } from "react";

import {
  DashboardInlineSummary,
  type InlineSummarySegment,
} from "@/components/dashboard/dashboard-inline-summary";
import {
  DASHBOARD_BODY_CLASS,
  DASHBOARD_EYEBROW_CLASS,
  DASHBOARD_ICON_CHIP_HEADER,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_TITLE_CLASS,
  type AccentTone,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type DashboardPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  descriptionLine2?: string;
  /** Optional icon chip (always neutral slate). */
  icon?: IconType;
  /** @deprecated Ignored — icons use one shared colour. */
  accent?: AccentTone;
  actions?: ReactNode;
  /** One-line stats, aligned under the description copy. */
  summary?: InlineSummarySegment[];
};

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  descriptionLine2,
  icon: Icon,
  accent: _accent = "slate",
  actions,
  summary,
}: DashboardPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 max-w-2xl items-start gap-3.5">
        {Icon ? (
          <span className={cn(DASHBOARD_ICON_CHIP_HEADER, "shrink-0")}>
            <Icon className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className={DASHBOARD_EYEBROW_CLASS}>{eyebrow}</p>
          <h1 className={cn("mt-2", DASHBOARD_TITLE_CLASS)}>{title}</h1>
          <p className={cn("mt-2", DASHBOARD_BODY_CLASS)}>{description}</p>
          {descriptionLine2 ? (
            <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
              {descriptionLine2}
            </p>
          ) : null}
          {summary && summary.length > 0 ? (
            <DashboardInlineSummary className="mt-2" segments={summary} />
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center lg:pt-1">{actions}</div>
      ) : null}
    </header>
  );
}
