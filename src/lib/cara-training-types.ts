/** Structured update Cara drafts from an owner answer. */
export type CaraTrainingPatch =
  | { kind: "faq"; question: string; answer: string }
  | { kind: "service_offered"; label: string }
  | { kind: "service_not_offered"; label: string }
  | { kind: "business_rule"; rule: string };

export type CaraTrainingStatus =
  | "awaiting_answer"
  | "draft_ready"
  | "applied"
  | "dismissed";

export type CaraTrainingSource =
  | "call_gap"
  | "action_inbox"
  | "owner_initiated";

export type CaraTrainingTargetSection =
  | "faq"
  | "services"
  | "services_not_offered"
  | "business_rules";

export type CaraTrainingOwnerMessage = {
  role: "user" | "assistant";
  content: string;
  at: string;
};

export type CaraTrainingItemRow = {
  id: string;
  organization_id: string;
  status: CaraTrainingStatus;
  source: CaraTrainingSource;
  call_log_id: string | null;
  action_ticket_id: string | null;
  gap_summary: string;
  caller_context: string | null;
  cara_question: string;
  owner_messages: CaraTrainingOwnerMessage[];
  proposed_patch: CaraTrainingPatch | null;
  applied_patch: CaraTrainingPatch | null;
  target_section: CaraTrainingTargetSection | null;
  applied_at: string | null;
  applied_by: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeGapPayload = {
  topic: string;
  caller_context?: string | null;
  cara_question: string;
  suggested_section?: string | null;
};

export function targetSectionForPatch(
  patch: CaraTrainingPatch,
): CaraTrainingTargetSection {
  switch (patch.kind) {
    case "faq":
      return "faq";
    case "service_offered":
      return "services";
    case "service_not_offered":
      return "services_not_offered";
    case "business_rule":
      return "business_rules";
  }
}

export function normalizeTrainingTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Parse and validate a proposed patch from JSON storage. */
export function parseCaraTrainingPatch(raw: unknown): CaraTrainingPatch | null {
  if (!isRecord(raw)) return null;
  const kind = raw.kind;
  if (kind === "faq") {
    const question = String(raw.question ?? "").trim();
    const answer = String(raw.answer ?? "").trim();
    if (!question && !answer) return null;
    return { kind: "faq", question, answer };
  }
  if (kind === "service_offered") {
    const label = String(raw.label ?? "").trim();
    if (!label) return null;
    return { kind: "service_offered", label };
  }
  if (kind === "service_not_offered") {
    const label = String(raw.label ?? "").trim();
    if (!label) return null;
    return { kind: "service_not_offered", label };
  }
  if (kind === "business_rule") {
    const rule = String(raw.rule ?? "").trim();
    if (!rule) return null;
    return { kind: "business_rule", rule };
  }
  return null;
}

export function parseOwnerMessages(raw: unknown): CaraTrainingOwnerMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: CaraTrainingOwnerMessage[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const role = entry.role === "assistant" ? "assistant" : "user";
    const content = String(entry.content ?? "").trim();
    const at = String(entry.at ?? "").trim();
    if (!content) continue;
    out.push({
      role,
      content,
      at: at || new Date().toISOString(),
    });
  }
  return out;
}
