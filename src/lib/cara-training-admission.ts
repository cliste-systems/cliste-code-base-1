import {
  isCakePolicyKnowledge,
  isStructuredHoursTopic,
  normalizeTrainingTopic,
  type CaraTrainingItemRow,
  type CaraTrainingSource,
} from "./cara-training-types";

export type TrainingDismissReason =
  | "customer_specific"
  | "already_answered"
  | "incorrect_misheard"
  | "duplicate"
  | "not_relevant";

export const TRAINING_DISMISS_REASON_LABELS: Record<TrainingDismissReason, string> = {
  customer_specific: "Customer-specific request",
  already_answered: "Already answered in Cara's knowledge",
  incorrect_misheard: "Incorrect or misheard question",
  duplicate: "Duplicate of another item",
  not_relevant: "Not relevant to teach",
};

export type TrainingAnswerPattern =
  | "existence"
  | "location"
  | "price"
  | "hours"
  | "policy"
  | "temporary"
  | "unclear"
  | "free_text";

export type TrainingAdmissionRejectReason =
  | "operational"
  | "insufficient_evidence"
  | "structured_hours"
  | "live_stock"
  | "customer_specific";

export type TrainingAdmissionResult =
  | {
      admit: false;
      reason: TrainingAdmissionRejectReason;
    }
  | {
      admit: true;
      displayQuestion: string;
      subjectLabel: string;
      answerPattern: TrainingAnswerPattern;
      evidence: string;
    };

function normalizeEvidenceText(text: string): string {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function combinedEvidence(input: {
  gapSummary: string;
  callerContext?: string | null;
  caraQuestion?: string | null;
}): string {
  return normalizeEvidenceText(
    [input.gapSummary, input.callerContext, input.caraQuestion].filter(Boolean).join("\n"),
  );
}

export function isGenericCaraQuestion(question: string): boolean {
  const q = normalizeEvidenceText(question).toLowerCase();
  return (
    q.includes("a caller asked something not in my setup") ||
    q.includes("what should i tell them in this situation")
  );
}

/** Customer-specific operational work — belongs in Action Inbox, not reusable knowledge. */
export function isCustomerOperationalRequest(text: string): boolean {
  const s = normalizeEvidenceText(text).toLowerCase();
  if (!s) return false;

  if (
    /\b(callback|call back|ring (them|him|her|me) back|complaint|refund|payment issue|delivery issue|lost property follow)\b/.test(
      s,
    )
  ) {
    return true;
  }

  if (
    /\b(order status|is my order|where is my order|ready for collection|prep for collection|pickup time|pick up time)\b/.test(
      s,
    )
  ) {
    return true;
  }

  if (/\border:\s*\S/.test(s) && /\b(collecting:|when:|prep for|sirloin|steak|kg\b)/.test(s)) {
    return true;
  }

  if (/\bbutcher order\b/.test(s) && /\b(order:|collecting:|prep for)\b/.test(s)) {
    return true;
  }

  if (/\b(wants to order|place an order|ordering a|order for \d+\s)/.test(s)) {
    return true;
  }

  if (
    /\b(birthday cake|celebration cake|custom cake)\b/.test(s) &&
    /\b(for \d+ people|needed on|collecting|message:|icing|flavour)\b/.test(s)
  ) {
    return true;
  }

  return false;
}

export function hasReusableQuestionEvidence(text: string): boolean {
  const s = normalizeEvidenceText(text).toLowerCase();
  if (!s || s.length < 8) return false;
  if (isCustomerOperationalRequest(text)) return false;

  if (isCakePolicyKnowledge(text)) return true;

  if (
    /\b(coin machine|change machine|atm|toilet|restroom|vacuum.?pack|opening hours|where are|how much|what fee|do we have|does the store have|can we|can you|asked if we|could not answer)\b/.test(
      s,
    )
  ) {
    return true;
  }

  if (/^(do|does|can|could|is|are|what|when|where|how)\b/.test(s) || s.endsWith("?")) {
    return true;
  }

  return false;
}

function inferDisplayQuestion(input: {
  gapSummary: string;
  callerContext?: string | null;
  caraQuestion?: string | null;
}): string {
  const caraQuestion = normalizeEvidenceText(input.caraQuestion ?? "");
  if (caraQuestion && !isGenericCaraQuestion(caraQuestion)) {
    return caraQuestion.endsWith("?") ? caraQuestion : `${caraQuestion}?`;
  }

  const evidence = combinedEvidence(input);
  const requestMatch = evidence.match(/(?:^|\n)request:\s*(.+)/i);
  if (requestMatch?.[1]?.trim()) {
    const request = requestMatch[1].trim();
    return request.endsWith("?") ? request : `${request}?`;
  }

  const gap = normalizeEvidenceText(input.gapSummary);
  if (/\bcoin machine|change machine|change for cash\b/i.test(gap)) {
    return "Do we have a coin machine?";
  }

  if (gap.endsWith("?")) return gap;
  if (/^(do|does|can|could|is|are|what|when|where|how)\b/i.test(gap)) {
    return gap.endsWith("?") ? gap : `${gap}?`;
  }

  return `Do we have ${gap.replace(/^the /i, "")}?`;
}

function inferAnswerPattern(evidence: string): TrainingAnswerPattern {
  const s = evidence.toLowerCase();
  if (isStructuredHoursTopic(s)) return "hours";
  if (/\b(notice needed|policy|rule|instructions|how far in advance|lead time|how much notice)\b/.test(s)) {
    return "policy";
  }
  if (/\b(where are|where is|directions to|located|location of)\b/.test(s)) {
    return "location";
  }
  if (/\b(how much|price|cost|per kg|per kilo|€|euro)\b/.test(s)) {
    return "price";
  }
  if (
    /\b(this week|until sunday|promo|promotion|offer|reduced|special)\b/.test(s) &&
    !/\border:\s*/.test(s)
  ) {
    return "temporary";
  }
  if (/\b(not sure|misheard|unclear|could not tell|unknown topic)\b/.test(s)) {
    return "unclear";
  }
  if (
    /\b(do we have|does the store have|do you have|is there a|coin machine|atm|toilet|wheelchair)\b/.test(
      s,
    )
  ) {
    return "existence";
  }
  return "free_text";
}

export function classifyTrainingAdmission(input: {
  gapSummary: string;
  callerContext?: string | null;
  caraQuestion?: string | null;
  source: CaraTrainingSource;
}): TrainingAdmissionResult {
  const evidence = combinedEvidence(input);

  if (!evidence || evidence.length < 4) {
    return { admit: false, reason: "insufficient_evidence" };
  }

  if (isStructuredHoursTopic(evidence)) {
    return { admit: false, reason: "structured_hours" };
  }

  if (/\b(in stock today|have any left today|sold out today|stock left now)\b/i.test(evidence)) {
    return { admit: false, reason: "live_stock" };
  }

  if (isCustomerOperationalRequest(evidence)) {
    return { admit: false, reason: "operational" };
  }

  if (input.source === "action_inbox" && !hasReusableQuestionEvidence(evidence)) {
    return { admit: false, reason: "insufficient_evidence" };
  }

  if (input.source === "call_gap" && !hasReusableQuestionEvidence(evidence)) {
    return { admit: false, reason: "insufficient_evidence" };
  }

  const displayQuestion = inferDisplayQuestion(input);
  const subjectLabel = normalizeEvidenceText(input.gapSummary).slice(0, 120) || displayQuestion;

  return {
    admit: true,
    displayQuestion,
    subjectLabel,
    answerPattern: inferAnswerPattern(evidence),
    evidence,
  };
}

export function classifyTrainingItem(item: CaraTrainingItemRow): TrainingAdmissionResult {
  return classifyTrainingAdmission({
    gapSummary: item.gap_summary,
    callerContext: item.caller_context,
    caraQuestion: item.cara_question,
    source: item.source,
  });
}

export function trainingQuestionDedupeKey(input: {
  gapSummary: string;
  caraQuestion?: string | null;
}): string {
  const admission = classifyTrainingAdmission({
    gapSummary: input.gapSummary,
    caraQuestion: input.caraQuestion,
    source: "call_gap",
  });
  if (admission.admit) {
    return normalizeTrainingTopic(admission.displayQuestion);
  }
  return normalizeTrainingTopic(input.gapSummary);
}

export function trainingListMetaLine(item: CaraTrainingItemRow): string {
  const admission = classifyTrainingItem(item);
  const parts: string[] = [];

  if (item.knowledge_topic_labels?.length) {
    parts.push(item.knowledge_topic_labels[0]!);
  } else if (admission.admit) {
    parts.push(
      admission.answerPattern === "existence"
        ? "General store information"
        : admission.answerPattern === "policy"
          ? "Store policy"
          : admission.answerPattern === "hours"
            ? "Opening hours"
            : "General store information",
    );
  }

  if (item.occurrence_count > 1) {
    parts.push(`Asked on ${item.occurrence_count} calls`);
  } else {
    parts.push("Recent call");
  }

  return parts.join(" · ");
}
