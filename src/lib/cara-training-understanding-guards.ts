import {
  classifyTrainingItem,
  type TrainingAnswerPattern,
} from "./cara-training-admission";

export type TrainingQuickChoice = "yes" | "no" | "depends";

/** Only catch obvious contradictions before LLM drafting — semantic gaps are handled by the model. */
export function detectTrainingAnswerAmbiguity(input: {
  ownerAnswer: string;
  caraQuestion: string;
  quickChoice?: TrainingQuickChoice | null;
}): string | null {
  const answer = input.ownerAnswer.trim();

  if (!answer) {
    return "Add what Cara should know before reviewing.";
  }

  if (input.quickChoice === "no" && /^(yes|yeah|yep)\b/i.test(answer)) {
    return "You selected No, but your note sounds like Yes — which is correct?";
  }
  if (input.quickChoice === "yes" && /^(no|nope|nah)\b/i.test(answer)) {
    return "You selected Yes, but your note sounds like No — which is correct?";
  }
  if (
    input.quickChoice === "yes" &&
    /\b(?:don't|do not|no)\s+(?:have|offer)\b/i.test(answer) &&
    !/\bbut\b/i.test(answer)
  ) {
    return "You selected Yes, but your note says you don't have this — should Cara treat it as available or not?";
  }

  return null;
}

/** Whether the answer needs LLM cleanup beyond a bare Yes./No. */
export function needsTrainingUnderstandingDraft(input: {
  ownerAnswer: string;
  quickChoice?: TrainingQuickChoice | null;
}): boolean {
  const answer = input.ownerAnswer.trim();
  if (!answer) return false;
  if (input.quickChoice === "depends") return true;
  if (answer === "Yes." || answer === "No.") return false;
  return true;
}

function stubTrainingItemForClassification(input: {
  gapSummary: string;
  callerContext?: string | null;
  caraQuestion: string;
}) {
  return {
    gap_summary: input.gapSummary,
    caller_context: input.callerContext ?? null,
    cara_question: input.caraQuestion,
    source: "call_gap" as const,
    status: "awaiting_answer" as const,
    id: "",
    organization_id: "",
    call_log_id: null,
    action_ticket_id: null,
    owner_messages: [],
    proposed_patch: null,
    applied_patch: null,
    target_section: null,
    applied_at: null,
    applied_by: null,
    dismissed_at: null,
    occurrence_count: 1,
    last_seen_at: "",
    created_at: "",
    updated_at: "",
  };
}

export function inferTrainingAnswerPattern(input: {
  gapSummary: string;
  callerContext?: string | null;
  caraQuestion: string;
}): TrainingAnswerPattern {
  const admission = classifyTrainingItem(
    stubTrainingItemForClassification(input),
  );
  return admission.admit ? admission.answerPattern : "free_text";
}

export function formatTrainingUnderstandingAssistantMessage(
  understoodAnswer: string,
): string {
  return `Understood: ${understoodAnswer.trim()}`;
}

export function normalizeTrainingQuestion(question: string): string {
  const trimmed = question.trim();
  if (!trimmed) return trimmed;
  return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
}

export function buildDeterministicTrainingFaqPatch(input: {
  caraQuestion: string;
  quickChoice: TrainingQuickChoice;
  ownerAnswer: string;
}): { kind: "faq"; question: string; answer: string } {
  const question = normalizeTrainingQuestion(input.caraQuestion);
  const answer = input.ownerAnswer.trim();
  if (input.quickChoice === "yes") {
    return { kind: "faq", question, answer: answer || "Yes." };
  }
  if (input.quickChoice === "no") {
    return { kind: "faq", question, answer: answer || "No." };
  }
  return { kind: "faq", question, answer };
}
