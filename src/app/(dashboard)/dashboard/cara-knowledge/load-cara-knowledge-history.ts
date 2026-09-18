import "server-only";

import {
  listCaraKnowledgeEvents,
} from "@/lib/cara-knowledge-events";
import { buildCaraKnowledgeHistoryTimeline } from "@/lib/cara-knowledge-history-build";
import { loadTemporalUpdatesForOrg } from "@/lib/cara-knowledge-temporal-store";
import { requireDashboardSession } from "@/lib/dashboard-session";

export type { CaraKnowledgeHistoryItem } from "@/lib/cara-knowledge-history-build";

export async function loadCaraKnowledgeHistory() {
  const { supabase, organizationId } = await requireDashboardSession();

  const [events, temporalRows, { data: trainingRows, error }] = await Promise.all([
    listCaraKnowledgeEvents(supabase, organizationId, 100),
    loadTemporalUpdatesForOrg(supabase, organizationId),
    supabase
      .from("cara_training_items")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["applied", "dismissed"])
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  if (error) {
    console.error("[cara-knowledge/history] load training items", error.message);
  }

  return buildCaraKnowledgeHistoryTimeline({
    events,
    temporalRows,
    trainingRows: (trainingRows ?? []) as Record<string, unknown>[],
  });
}
