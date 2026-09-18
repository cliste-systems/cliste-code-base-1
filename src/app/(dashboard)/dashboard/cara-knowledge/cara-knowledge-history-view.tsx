import {
  CaraKnowledgeSectionHeader,
} from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-hub-shell";
import { CaraKnowledgeHistoryPanel } from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-history-panel";
import {
  DASHBOARD_CARD_SURFACE,
} from "@/components/dashboard/dashboard-surface";
import type { CaraKnowledgeHistoryItem } from "@/app/(dashboard)/dashboard/cara-knowledge/load-cara-knowledge-history";
import { cn } from "@/lib/utils";

export function CaraKnowledgeHistoryView({
  items,
}: {
  items: CaraKnowledgeHistoryItem[];
}) {
  return (
    <>
      <CaraKnowledgeSectionHeader
        title="History"
        description="How Cara's knowledge has changed — from calls, teaching, Business profile, and unlearning."
      />

      <div className={cn(DASHBOARD_CARD_SURFACE, "overflow-hidden")}>
        <CaraKnowledgeHistoryPanel items={items} />
      </div>
    </>
  );
}
