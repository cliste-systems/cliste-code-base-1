import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CaraKnowledgeEventType =
  | "learned"
  | "edited"
  | "unlearned"
  | "temporal_started"
  | "temporal_ended"
  | "temporal_expired"
  | "temporal_cancelled";

export type CaraKnowledgeEventSource =
  | "call_gap"
  | "owner_initiated"
  | "business_setup"
  | "unlearn"
  | "action_inbox";

export type CaraKnowledgeEventRow = {
  id: string;
  organization_id: string;
  event_type: CaraKnowledgeEventType;
  category: string | null;
  title: string;
  payload: Record<string, unknown> | null;
  source: CaraKnowledgeEventSource | string;
  actor_id: string | null;
  call_log_id: string | null;
  training_item_id: string | null;
  created_at: string;
};

export async function recordCaraKnowledgeEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    eventType: CaraKnowledgeEventType;
    category?: string | null;
    title: string;
    payload?: Record<string, unknown> | null;
    source: CaraKnowledgeEventSource | string;
    actorId?: string | null;
    callLogId?: string | null;
    trainingItemId?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("cara_knowledge_events").insert({
    organization_id: input.organizationId,
    event_type: input.eventType,
    category: input.category ?? null,
    title: input.title.slice(0, 500),
    payload: input.payload ?? {},
    source: input.source,
    actor_id: input.actorId ?? null,
    call_log_id: input.callLogId ?? null,
    training_item_id: input.trainingItemId ?? null,
  });

  if (error) {
    console.warn("[cara-knowledge-events] insert failed", error.message);
  }
}

export async function listCaraKnowledgeEvents(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 100,
): Promise<CaraKnowledgeEventRow[]> {
  const { data, error } = await supabase
    .from("cara_knowledge_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[cara-knowledge-events] list failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    organization_id: String(row.organization_id),
    event_type: row.event_type as CaraKnowledgeEventType,
    category: row.category ? String(row.category) : null,
    title: String(row.title ?? ""),
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    source: String(row.source ?? ""),
    actor_id: row.actor_id ? String(row.actor_id) : null,
    call_log_id: row.call_log_id ? String(row.call_log_id) : null,
    training_item_id: row.training_item_id ? String(row.training_item_id) : null,
    created_at: String(row.created_at),
  }));
}
