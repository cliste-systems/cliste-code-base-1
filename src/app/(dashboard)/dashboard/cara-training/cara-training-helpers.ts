import { formatCallDateTimeLabel } from "@/lib/call-history-types";
import {
  parseCaraTrainingPatch,
  parseOwnerMessages,
  type CaraTrainingItemRow,
  type CaraTrainingPatch,
  type CaraTrainingSource,
  type CaraTrainingStatus,
  type CaraTrainingTargetSection,
} from "@/lib/cara-training-types";

export type CaraTrainingListItem = CaraTrainingItemRow;

export const CARA_TRAINING_SOURCE_LABELS: Record<CaraTrainingSource, string> = {
  call_gap: "From a call",
  action_inbox: "From Action Inbox",
  owner_initiated: "You taught Cara",
};

export const CARA_TRAINING_SECTION_LABELS: Record<
  CaraTrainingTargetSection,
  string
> = {
  faq: "Answers & files",
  services: "Services",
  services_not_offered: "Services — not offered",
  business_rules: "Call handling",
};

export function rowToTrainingItem(row: Record<string, unknown>): CaraTrainingListItem {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    status: row.status as CaraTrainingStatus,
    source: row.source as CaraTrainingSource,
    call_log_id: row.call_log_id ? String(row.call_log_id) : null,
    action_ticket_id: row.action_ticket_id
      ? String(row.action_ticket_id)
      : null,
    gap_summary: String(row.gap_summary ?? ""),
    caller_context: row.caller_context ? String(row.caller_context) : null,
    cara_question: String(row.cara_question ?? ""),
    owner_messages: parseOwnerMessages(row.owner_messages),
    proposed_patch: parseCaraTrainingPatch(row.proposed_patch),
    applied_patch: parseCaraTrainingPatch(row.applied_patch),
    target_section: (row.target_section as CaraTrainingTargetSection) ?? null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    applied_by: row.applied_by ? String(row.applied_by) : null,
    dismissed_at: row.dismissed_at ? String(row.dismissed_at) : null,
    occurrence_count:
      typeof row.occurrence_count === "number" && row.occurrence_count > 0
        ? row.occurrence_count
        : 1,
    last_seen_at: row.last_seen_at
      ? String(row.last_seen_at)
      : String(row.created_at ?? new Date().toISOString()),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function formatTrainingDateTime(iso: string): string {
  return formatCallDateTimeLabel(iso);
}

export function patchPreviewLines(patch: CaraTrainingPatch): string[] {
  switch (patch.kind) {
    case "faq":
      return [`Question: ${patch.question}`, `Answer: ${patch.answer}`];
    case "service_offered":
      return [`Add to what you offer: ${patch.label}`];
    case "service_not_offered":
      return [`Add to what you don't offer: ${patch.label}`];
    case "business_rule":
      return [`Add business rule: ${patch.rule}`];
  }
}

export function isOpenTrainingStatus(status: CaraTrainingStatus): boolean {
  return status === "awaiting_answer" || status === "draft_ready";
}

function truncateTrainingLabel(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function gapSummaryWithoutCallerPrefix(gapSummary: string): string {
  return gapSummary.replace(/\s+/g, " ").trim().replace(/^Caller:\s*[^.]+\.\s*/i, "").trim();
}

/** Short topic for list rows and the detail header — prefers patch label over raw ticket text. */
export function trainingTopicLabel(item: CaraTrainingListItem): string {
  const patch = item.applied_patch ?? item.proposed_patch;
  if (patch) {
    switch (patch.kind) {
      case "service_not_offered":
      case "service_offered":
        return patch.label;
      case "faq":
        return truncateTrainingLabel(patch.question);
      case "business_rule":
        return truncateTrainingLabel(patch.rule);
    }
  }

  const fromGap = gapSummaryWithoutCallerPrefix(item.gap_summary);
  if (fromGap) return truncateTrainingLabel(fromGap);
  return "Training item";
}

/** @deprecated Use trainingTopicLabel */
export function trainingItemTitle(item: CaraTrainingListItem): string {
  return trainingTopicLabel(item);
}

export function trainingDetailMeta(item: CaraTrainingListItem): string {
  const parts = [
    CARA_TRAINING_SOURCE_LABELS[item.source],
    item.target_section
      ? CARA_TRAINING_SECTION_LABELS[item.target_section]
      : null,
    formatTrainingDateTime(
      item.status === "applied" && item.applied_at
        ? item.applied_at
        : item.created_at,
    ),
  ].filter(Boolean);
  return parts.join(" · ");
}

export function lastOwnerAnswer(item: CaraTrainingListItem): string | null {
  const answer = item.owner_messages
    .filter((message) => message.role === "user")
    .at(-1)
    ?.content?.trim();
  return answer || null;
}

/** Extra context when it adds detail beyond the topic line — omit when redundant. */
export function trainingContextSummary(item: CaraTrainingListItem): string | null {
  const topic = trainingTopicLabel(item).toLowerCase();
  const context = item.caller_context?.replace(/\s+/g, " ").trim();
  if (context && context.length > 0) {
    if (!context.toLowerCase().includes(topic) || context.length > topic.length + 24) {
      return context;
    }
  }

  const gap = gapSummaryWithoutCallerPrefix(item.gap_summary);
  if (!gap) return null;
  const gapLower = gap.toLowerCase();
  if (gapLower === topic || gapLower.startsWith(topic)) return null;
  return truncateTrainingLabel(gap, 280);
}

export function trainingStatusLabel(status: CaraTrainingStatus): string {
  switch (status) {
    case "applied":
      return "Learned";
    case "draft_ready":
      return "Ready to confirm";
    default:
      return "Needs input";
  }
}

export function trainingStatusVariant(
  status: CaraTrainingStatus,
): "brand" | "info" | "attention" {
  switch (status) {
    case "applied":
      return "brand";
    case "draft_ready":
      return "info";
    default:
      return "attention";
  }
}

export function trainingContextLine(item: CaraTrainingListItem): string {
  if (item.source === "call_gap") {
    const count =
      item.occurrence_count > 1
        ? ` (asked ${item.occurrence_count} times)`
        : "";
    return `On a call — ${item.gap_summary}${count}`;
  }
  if (item.source === "action_inbox") {
    return `From Action Inbox — ${item.gap_summary}`;
  }
  return item.gap_summary;
}
