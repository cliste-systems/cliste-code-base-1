import type { CaraKnowledgeEventRow } from "@/lib/cara-knowledge-events";
import { matchesKnowledgeSearchQuery } from "@/lib/cara-knowledge-index";
import type { TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import {
  enrichHistoryItem,
  inferPatchHistoryCategory,
} from "@/lib/cara-knowledge-history-labels";
import {
  parseCaraTrainingPatch,
  type CaraTrainingPatch,
} from "@/lib/cara-training-types";

export type CaraKnowledgeHistoryItem = {
  id: string;
  kind:
    | "learned"
    | "edited"
    | "unlearned"
    | "dismissed"
    | "reverted"
    | "temporal_started"
    | "temporal_ended"
    | "temporal_expired"
    | "temporal_cancelled";
  title: string;
  subtitle?: string;
  category?: string | null;
  source: string;
  createdAt: string;
  actionLabel: string;
  categoryLabel: string | null;
  sourceHint: string | null;
};

function patchTitle(patch: CaraTrainingPatch): string {
  if (patch.kind === "faq") return patch.question;
  if (patch.kind === "service_offered" || patch.kind === "service_not_offered") {
    return patch.label;
  }
  return patch.rule;
}

function trainingHistoryTitle(row: Record<string, unknown>): string {
  const applied = parseCaraTrainingPatch(row.applied_patch);
  if (applied) return patchTitle(applied);
  const proposed = parseCaraTrainingPatch(row.proposed_patch);
  if (proposed) return patchTitle(proposed);
  return String(row.gap_summary ?? "Training item");
}

function trainingHistoryCategory(row: Record<string, unknown>): string | null {
  const applied = parseCaraTrainingPatch(row.applied_patch);
  if (applied) return inferPatchHistoryCategory(applied);
  const proposed = parseCaraTrainingPatch(row.proposed_patch);
  if (proposed) return inferPatchHistoryCategory(proposed);
  return null;
}

function shouldIncludeHistoryEvent(event: CaraKnowledgeEventRow): boolean {
  if (event.event_type !== "edited") return true;
  return event.source !== "auto_classify" && event.source !== "training_apply";
}

function eventToHistoryItem(event: CaraKnowledgeEventRow): CaraKnowledgeHistoryItem {
  const kind = event.event_type as CaraKnowledgeHistoryItem["kind"];
  return enrichHistoryItem({
    id: `event-${event.id}`,
    kind,
    title: event.title,
    category: event.category,
    subtitle: event.category ?? undefined,
    source: event.source,
    createdAt: event.created_at,
  });
}

function temporalEventIds(events: CaraKnowledgeEventRow[]): {
  started: Set<string>;
  ended: Set<string>;
  cancelled: Set<string>;
} {
  const started = new Set<string>();
  const ended = new Set<string>();
  const cancelled = new Set<string>();

  for (const event of events) {
    const updateId = event.payload?.temporalUpdateId;
    if (typeof updateId !== "string" || !updateId) continue;
    if (event.event_type === "temporal_started") started.add(updateId);
    if (event.event_type === "temporal_ended" || event.event_type === "temporal_expired") {
      ended.add(updateId);
    }
    if (event.event_type === "temporal_cancelled") cancelled.add(updateId);
  }

  return { started, ended, cancelled };
}

function temporalRowsToHistoryItems(
  rows: TemporalUpdateRecord[],
  covered: ReturnType<typeof temporalEventIds>,
): CaraKnowledgeHistoryItem[] {
  const items: CaraKnowledgeHistoryItem[] = [];

  for (const row of rows) {
    if (!covered.started.has(row.id)) {
      items.push(
        enrichHistoryItem({
          id: `temporal-${row.id}-started`,
          kind: "temporal_started",
          title: row.title,
          category: row.subjectType,
          source: "owner_initiated",
          createdAt: row.createdAt,
        }),
      );
    }

    if (row.endedAt && !covered.ended.has(row.id)) {
      items.push(
        enrichHistoryItem({
          id: `temporal-${row.id}-ended`,
          kind: "temporal_ended",
          title: row.title,
          category: row.subjectType,
          source: "owner_initiated",
          createdAt: row.endedAt,
        }),
      );
    }

    if (row.cancelledAt && !covered.cancelled.has(row.id)) {
      items.push(
        enrichHistoryItem({
          id: `temporal-${row.id}-cancelled`,
          kind: "temporal_cancelled",
          title: row.title,
          category: row.subjectType,
          source: "owner_initiated",
          createdAt: row.cancelledAt,
        }),
      );
    }
  }

  return items;
}

function trainingToHistoryItem(
  row: Record<string, unknown>,
  temporalTrainingIds: Set<string>,
): CaraKnowledgeHistoryItem | null {
  const status = String(row.status ?? "");
  const createdAt = String(
    row.applied_at ?? row.dismissed_at ?? row.updated_at ?? row.created_at ?? "",
  );
  if (!createdAt) return null;

  if (status === "applied") {
    if (temporalTrainingIds.has(String(row.id))) {
      return null;
    }
    return enrichHistoryItem({
      id: `training-${String(row.id)}-applied`,
      kind: "learned",
      title: trainingHistoryTitle(row),
      category: trainingHistoryCategory(row),
      source: String(row.source ?? "call_gap"),
      createdAt,
    });
  }

  if (status === "dismissed") {
    const hasAppliedPatch = parseCaraTrainingPatch(row.applied_patch) !== null;
    return enrichHistoryItem({
      id: `training-${String(row.id)}-dismissed`,
      kind: hasAppliedPatch ? "reverted" : "dismissed",
      title: trainingHistoryTitle(row),
      category: trainingHistoryCategory(row),
      source: String(row.source ?? "call_gap"),
      createdAt,
    });
  }

  return null;
}

export function buildCaraKnowledgeHistoryTimeline(input: {
  events: CaraKnowledgeEventRow[];
  temporalRows: TemporalUpdateRecord[];
  trainingRows: Record<string, unknown>[];
}): CaraKnowledgeHistoryItem[] {
  const coveredTemporalEvents = temporalEventIds(input.events);
  const temporalTrainingIds = new Set(
    input.temporalRows
      .map((row) => row.trainingItemId)
      .filter((id): id is string => Boolean(id)),
  );

  const eventTrainingIds = new Set(
    input.events
      .map((event) => event.training_item_id)
      .filter((id): id is string => Boolean(id)),
  );

  const timeline: CaraKnowledgeHistoryItem[] = [
    ...input.events
      .filter(shouldIncludeHistoryEvent)
      .map(eventToHistoryItem),
    ...temporalRowsToHistoryItems(input.temporalRows, coveredTemporalEvents),
    ...input.trainingRows
      .filter((row) => !eventTrainingIds.has(String(row.id)))
      .map((row) => trainingToHistoryItem(row, temporalTrainingIds))
      .filter((item): item is CaraKnowledgeHistoryItem => item !== null),
  ];

  timeline.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return timeline.slice(0, 100);
}

export function filterCaraKnowledgeHistoryItems(
  items: CaraKnowledgeHistoryItem[],
  query: string,
): CaraKnowledgeHistoryItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items;
  return items.filter((item) =>
    matchesKnowledgeSearchQuery(
      trimmed,
      item.title,
      item.subtitle ?? "",
      item.actionLabel,
      item.categoryLabel ?? "",
    ),
  );
}
