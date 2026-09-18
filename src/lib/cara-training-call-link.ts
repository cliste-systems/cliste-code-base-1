import { buildTrainingCallFacts } from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import type { CaraTrainingItemRow } from "./cara-training-types";

type CallLogMatchRow = {
  id: string;
  ai_summary: string | null;
  created_at: string;
};

const CALL_LINK_WINDOW_MS = 2 * 60 * 60 * 1000;

function trainingMatchTerms(item: CaraTrainingItemRow): string[] {
  const raw = [item.gap_summary, item.cara_question, item.caller_context]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const terms = new Set<string>();
  for (const token of raw.split(/[^a-z0-9]+/i)) {
    const word = token.trim();
    if (word.length >= 5) terms.add(word);
  }

  return [...terms];
}

function summaryMatchesTrainingItem(
  summary: string | null | undefined,
  item: CaraTrainingItemRow,
): boolean {
  const text = String(summary ?? "").toLowerCase();
  if (!text) return false;
  const terms = trainingMatchTerms(item);
  if (terms.length === 0) return false;
  return terms.some((term) => text.includes(term));
}

/** Best-effort link to the originating call when call_log_id was not stored. */
export function resolveTrainingCallLogId(
  item: CaraTrainingItemRow,
  calls: CallLogMatchRow[],
): string | null {
  if (item.call_log_id?.trim()) return item.call_log_id.trim();
  if (item.source !== "call_gap") return null;

  const anchor = new Date(item.last_seen_at || item.created_at).getTime();
  if (!Number.isFinite(anchor)) return null;

  let bestId: string | null = null;
  let bestDelta = Infinity;

  for (const call of calls) {
    const callTs = new Date(call.created_at).getTime();
    if (!Number.isFinite(callTs)) continue;
    const delta = Math.abs(callTs - anchor);
    if (delta > CALL_LINK_WINDOW_MS) continue;
    if (!summaryMatchesTrainingItem(call.ai_summary, item)) continue;
    if (delta < bestDelta) {
      bestDelta = delta;
      bestId = call.id;
    }
  }

  return bestId;
}

export function enrichTrainingItemsWithCallLinks<
  T extends CaraTrainingItemRow,
>(items: T[], calls: CallLogMatchRow[]): T[] {
  if (calls.length === 0) return items;

  return items.map((item) => {
    const callLogId = resolveTrainingCallLogId(item, calls);
    if (!callLogId || item.call_log_id === callLogId) return item;
    return { ...item, call_log_id: callLogId };
  });
}

type CallLogFactsRow = {
  id: string;
  created_at: string;
  duration_seconds: number;
  caller_number: string;
};

export function enrichTrainingItemsWithCallFacts<
  T extends CaraTrainingItemRow,
>(items: T[], callLogs: CallLogFactsRow[]): T[] {
  if (callLogs.length === 0) {
    return items.map((item) => ({
      ...item,
      call_facts: buildTrainingCallFacts(item),
    }));
  }

  const byId = new Map(callLogs.map((row) => [row.id, row]));

  return items.map((item) => {
    const callLog = item.call_log_id ? byId.get(item.call_log_id) ?? null : null;
    return {
      ...item,
      call_facts: buildTrainingCallFacts(item, callLog),
    };
  });
}
