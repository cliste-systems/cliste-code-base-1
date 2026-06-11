"use client";

import { CaraStatusCard } from "@/components/dashboard/dashboard-cara-status-card";
import { NeedsAttentionCard } from "@/components/dashboard/dashboard-needs-attention-card";
import { RecentActivityCard } from "@/components/dashboard/dashboard-recent-activity-card";
import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { CaraStatusSnapshot } from "@/lib/cara-status";

export function DashboardHomeWorkspacePanels({
  caraStatus,
  callOutcomes,
  callDurationSeconds,
  activity,
  attentionItems,
  openActions,
}: {
  periodPhrase: string;
  caraStatus: CaraStatusSnapshot;
  callOutcomes: (string | null)[];
  callDurationSeconds: (number | null)[];
  activity: TimelineFeedRow[];
  attentionItems: TimelineFeedRow[];
  openActions: number;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:items-stretch">
      <RecentActivityCard activity={activity} />

      <div className="flex h-full min-h-0 flex-col gap-4 md:min-h-0">
        <CaraStatusCard
          caraStatus={caraStatus}
          callOutcomes={callOutcomes}
          callDurationSeconds={callDurationSeconds}
        />
        <NeedsAttentionCard
          attentionItems={attentionItems}
          openActions={openActions}
        />
      </div>
    </div>
  );
}
