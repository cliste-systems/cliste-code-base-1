"use client";

import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";

import { DashboardSectionLink } from "@/components/dashboard/dashboard-editorial-section";
import { DashboardHomeFilledFeed } from "@/components/dashboard/dashboard-home-filled-feed";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  DASHBOARD_HOME_CARD,
  DASHBOARD_HOME_PANEL_EMPTY_ACTION,
  DASHBOARD_HOME_PANEL_EMPTY_BODY,
  DASHBOARD_HOME_PANEL_EMPTY_ICON,
  DASHBOARD_HOME_PANEL_EMPTY_INSET,
  DASHBOARD_HOME_PANEL_EMPTY_TITLE,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_HOME_ATTENTION_ROW_LIMIT } from "@/lib/dashboard-home-panel-limit";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function InboxZeroState() {
  return (
    <Link
      href={DASHBOARD_ROUTES.actionInbox}
      className={cn(DASHBOARD_HOME_PANEL_EMPTY_INSET, "group")}
    >
      <div className={DASHBOARD_HOME_PANEL_EMPTY_ICON} aria-hidden>
        <Inbox className="size-6" />
      </div>
      <p className={DASHBOARD_HOME_PANEL_EMPTY_TITLE}>Inbox zero</p>
      <p className={DASHBOARD_HOME_PANEL_EMPTY_BODY}>
        Nothing waiting on you.
      </p>
      <span className={DASHBOARD_HOME_PANEL_EMPTY_ACTION}>
        Open Action Inbox
        <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}

export function NeedsAttentionCard({
  attentionItems,
  openActions,
  className,
}: {
  attentionItems: TimelineFeedRow[];
  openActions: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        DASHBOARD_HOME_CARD,
        "flex min-h-0 flex-1 flex-col",
        className,
      )}
    >
      <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
          Needs attention
        </h2>
        {openActions > 0 ? (
          <DashboardSectionLink href={DASHBOARD_ROUTES.actionInbox}>
            View all
          </DashboardSectionLink>
        ) : null}
      </div>

      {attentionItems.length > 0 ? (
        <DashboardHomeFilledFeed
          rows={attentionItems}
          homePanelTone="attention"
          maxRows={DASHBOARD_HOME_ATTENTION_ROW_LIMIT}
          emptyIcon={Inbox}
          emptyTitle="Inbox zero"
          emptyBody=""
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <InboxZeroState />
        </div>
      )}
    </section>
  );
}
