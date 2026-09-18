/** A single question/answer Cara can use during a call. */
export type AgentFaq = {
  question: string;
  answer: string;
};

export const MAX_FAQS = 30;
export const MAX_FAQ_FIELD_LEN = 1000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Tolerant parse of the organizations.agent_faqs jsonb column. */
export function parseAgentFaqs(raw: unknown): AgentFaq[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentFaq[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const question = typeof entry.question === "string" ? entry.question : "";
    const answer = typeof entry.answer === "string" ? entry.answer : "";
    if (!question && !answer) continue;
    out.push({ question, answer });
  }
  return out;
}

/** Drop empty rows and clamp field lengths before persisting. Does not silently drop rows beyond the prompt compile cap. */
export function cleanAgentFaqs(raw: unknown): AgentFaq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => ({
      question: String((entry as AgentFaq)?.question ?? "")
        .trim()
        .slice(0, MAX_FAQ_FIELD_LEN),
      answer: String((entry as AgentFaq)?.answer ?? "")
        .trim()
        .slice(0, MAX_FAQ_FIELD_LEN),
    }))
    .filter((f) => f.question || f.answer);
}

/** Legacy prompt compile still reads only the first MAX_FAQS entries. */
export function faqsForLegacyPromptCompile(faqs: AgentFaq[]): AgentFaq[] {
  return faqs.slice(0, MAX_FAQS);
}

export function faqCapacityStatus(faqCount: number): {
  atCapacity: boolean;
  message: string | null;
} {
  if (faqCount < MAX_FAQS) {
    return { atCapacity: false, message: null };
  }
  return {
    atCapacity: true,
    message: `Cara's compiled prompt includes up to ${MAX_FAQS} FAQs. You have ${faqCount}. New FAQ answers can still be saved, but scalable retrieval beyond this cap requires the knowledge index — not unlimited prompt stuffing.`,
  };
}
