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

/** Drop empty rows and clamp lengths before persisting. */
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
    .filter((f) => f.question || f.answer)
    .slice(0, MAX_FAQS);
}
