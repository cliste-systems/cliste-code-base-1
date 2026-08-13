"use client";

import { Activity } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardTimelineFeed } from "@/components/dashboard/dashboard-timeline-feed";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import { cn } from "@/lib/utils";

import { DashboardHeaderRangeControls } from "../dashboard-header-range-controls";

/** Today / Yesterday / "Mon 23 Jun" — the heading for a day group. */
function dayGroupLabel(iso: string | undefined): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (d >= startToday) return "Today";
  if (d >= startYesterday) return "Yesterday";
  return d.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Bucket the (already newest-first) feed into consecutive day groups. */
function groupRowsByDay(
  rows: TimelineFeedRow[],
): { label: string; rows: TimelineFeedRow[] }[] {
  const groups: { label: string; rows: TimelineFeedRow[] }[] = [];
  let current: { label: string; rows: TimelineFeedRow[] } | null = null;
  for (const row of rows) {
    const label = dayGroupLabel(row.isoDate);
    if (!current || current.label !== label) {
      current = { label, rows: [] };
      groups.push(current);
    }
    current.rows.push(row);
  }
  return groups;
}

export function ActivityView({
  rows,
  summary,
}: {
  rows: TimelineFeedRow[];
  summary: { value: string; label: string }[];
}) {
  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections className="min-h-0 flex-1 overflow-hidden">
          <ClistePageHeader
            tone="activity"
            icon={Activity}
            title="Activity"
            description="Calls answered, links sent, and enquiries captured."
            summary={summary}
            actions={<DashboardHeaderRangeControls />}
          />

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
                <div className="flex h-full w-full items-center justify-center p-6">
                  <EmptyState
                    icon={Activity}
                    title="No activity yet"
                    description="When Cara sends links, PDFs, or handles calls, it will show up here."
                    className="w-full max-w-xl px-4 py-12"
                  />
                </div>
              ) : (
                <div className="py-1">
                  {groupRowsByDay(rows).map((group) => (
                    <div key={group.label}>
                      <div className="sticky top-0 z-10 bg-white/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm">
                        {group.label}
                      </div>
                      <DashboardTimelineFeed
                        rows={group.rows}
                        pageFeed
                        emptyIcon={Activity}
                        emptyTitle="No activity yet"
                        emptyBody="When Cara sends links, PDFs, or handles calls, it will show up here."
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
