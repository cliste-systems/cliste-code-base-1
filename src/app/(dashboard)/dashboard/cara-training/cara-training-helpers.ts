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

export function trainingContextLine(item: CaraTrainingListItem): string {
  if (item.source === "call_gap") {
    return `On a call — ${item.gap_summary}`;
  }
  if (item.source === "action_inbox") {
    return `From Action Inbox — ${item.gap_summary}`;
  }
  return item.gap_summary;
}
