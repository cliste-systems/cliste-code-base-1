"use client";

import { Activity } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardTimelineFeed } from "@/components/dashboard/dashboard-timeline-feed";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import { cn } from "@/lib/utils";

import { DashboardHeaderRangeControls } from "../dashboard-header-range-controls";

export function ActivityView({ rows }: { rows: TimelineFeedRow[] }) {
  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections>
          <header className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={DASHBOARD_ICON_CHIP_LG}>
                <Activity className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[26px]">
                  Activity
                </h1>
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                  Everything Cara does on calls — links and PDFs sent, files
                  shared, calls answered, and requests captured.
                </p>
              </div>
            </div>
            <DashboardHeaderRangeControls />
          </header>

          <section
            className={cn(
              DASHBOARD_CARD_SURFACE,
              "flex min-h-0 flex-1 flex-col overflow-hidden",
            )}
          >
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
                rows.length === 0 && "flex items-center justify-center",
              )}
            >
              {rows.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="When Cara sends links, PDFs, or handles calls, it will show up here."
                  className="w-full py-10"
                />
              ) : (
                <DashboardTimelineFeed
                  rows={rows}
                  emptyIcon={Activity}
                  emptyTitle="No activity yet"
                  emptyBody="When Cara sends links, PDFs, or handles calls, it will show up here."
                  className="px-4 py-2 sm:px-5"
                />
              )}
            </div>
          </section>
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
