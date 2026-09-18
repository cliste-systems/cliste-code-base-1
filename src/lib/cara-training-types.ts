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
  occurrence_count: number;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  knowledge_folder_id?: string | null;
  knowledge_department_ids?: string[];
  knowledge_topic_labels?: string[];
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

/** Policy-style cake/bakery knowledge — teachable despite bakery wording. */
export function isCakePolicyKnowledge(text: string): boolean {
  const s = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return (
    /\b(how much notice|notice needed|minimum notice|advance notice|lead time|how far in advance)\b/.test(
      s,
    ) && /\b(cake|bakery|celebration)\b/.test(s)
  );
}

/**
 * A routine booking/callback/customer order handoff is NOT a teachable knowledge gap.
 * Policy questions (e.g. cake notice period) are not blocked here.
 */
export function isRoutineHandoff(summary: string): boolean {
  const s = String(summary ?? "").toLowerCase();
  if (isCakePolicyKnowledge(summary)) return false;

  if (
    /\b(book|booking|booked|appointment|appt|slot|reschedul|cancel|patch test|call ?back|callbacks?|ring (them|him|her|me) back)\b/.test(
      s,
    )
  ) {
    return true;
  }

  if (/\b(wants to order|ordering a|place an order|order for \d+\s)/.test(s)) {
    return true;
  }

  if (
    /\b(birthday cake|celebration cake|custom cake)\b/.test(s) &&
    /\b(for \d+ people|needed on|collecting|message:|icing|flavour)\b/.test(s)
  ) {
    return true;
  }

  if (/\border:\s*\S/.test(s) && /\b(collecting:|when:|prep for|sirloin|steak)\b/.test(s)) {
    return true;
  }

  if (/\bbutcher order\b/.test(s) && /\b(order:|collecting:|prep for)\b/.test(s)) {
    return true;
  }

  return false;
}

/** Alias for clarity at ingestion sites. */
export const isOperationalHandoff = isRoutineHandoff;

/** Action Inbox ticket where Cara could not answer from setup — teachable gap, not a sales lead. */
export function isKnowledgeEnquiryHandoff(summary: string): boolean {
  const s = String(summary ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return false;
  if (isRoutineHandoff(summary)) return false;
  return (
    /\b(coin machine|change machine|coin.*machine|exchange coins|change for cash)\b/.test(s) ||
    /\b(does the store have|do we have|asked if we have|asked about|caller asked|not sure|could not answer|unknown topic)\b/.test(
      s,
    ) ||
    /^[a-z0-9 /-]+ enquiry\b/.test(s)
  );
}

/**
 * Opening-hours and bank-holiday topics are answered programmatically for retail
 * orgs with structured business_hours — not teachable service-offer gaps.
 */
export function isStructuredHoursTopic(text: string): boolean {
  const t = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  if (
    /\b(opening hours|opening hour|open hours|what time.*open|when.*open|are you open|you open|closing time|close at|hours on|open on|open tomorrow|open today)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(st patrick|saint patrick|paddy'?s day|paddys day|bank holiday|public holiday|good friday|easter monday|christmas day|st stephen|boxing day|new year'?s day)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
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
