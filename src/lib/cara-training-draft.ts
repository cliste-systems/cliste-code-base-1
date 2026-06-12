import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

import {
  parseCaraTrainingPatch,
  type CaraTrainingPatch,
} from "./cara-training-types";

export type CaraTrainingKnowledgeSnapshot = {
  businessName: string;
  faqs: { question: string; answer: string }[];
  servicesOffered: string[];
  servicesNotOffered: string[];
  businessRules: string[];
};

export type DraftTrainingPatchInput = {
  gapSummary: string;
  callerContext?: string | null;
  caraQuestion: string;
  ownerAnswer: string;
  knowledge: CaraTrainingKnowledgeSnapshot;
};

function parseDraftJson(raw: string): CaraTrainingPatch | null {
  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    return parseCaraTrainingPatch(parsed);
  } catch {
    return null;
  }
}

function knowledgeContextBlock(knowledge: CaraTrainingKnowledgeSnapshot): string {
  const faqLines =
    knowledge.faqs.length > 0
      ? knowledge.faqs
          .map(
            (f) =>
              `- Q: ${f.question.slice(0, 200)} / A: ${f.answer.slice(0, 200)}`,
          )
          .join("\n")
      : "(none yet)";
  return [
    `Business: ${knowledge.businessName}`,
    `Services offered: ${knowledge.servicesOffered.join(", ") || "(none)"}`,
    `Services not offered: ${knowledge.servicesNotOffered.join(", ") || "(none)"}`,
    `Business rules: ${knowledge.businessRules.join("; ") || "(none)"}`,
    `Existing FAQs:\n${faqLines}`,
  ].join("\n");
}

/**
 * Turn the owner's plain-English answer into a structured Cara Setup patch.
 */
export async function draftTrainingPatchFromOwnerAnswer(
  input: DraftTrainingPatchInput,
): Promise<{ ok: true; patch: CaraTrainingPatch } | { ok: false; message: string }> {
  const ownerAnswer = input.ownerAnswer.trim();
  if (!ownerAnswer) {
    return { ok: false, message: "Enter an answer before continuing." };
  }

  const system = `You help Cara, a phone assistant, turn a business owner's plain-English answer into ONE structured knowledge update.

Current business knowledge:
${knowledgeContextBlock(input.knowledge)}

Output ONLY valid JSON (no markdown) with exactly one of these shapes:
{"kind":"faq","question":"...","answer":"..."}
{"kind":"service_offered","label":"..."}
{"kind":"service_not_offered","label":"..."}
{"kind":"business_rule","rule":"..."}

Rules:
- Pick the best target kind for the gap and owner answer.
- FAQ: caller-style question + concise answer Cara can speak on calls.
- service_offered / service_not_offered: short chip label (max 80 chars).
- business_rule: one imperative sentence Cara should follow (max 200 chars).
- Never invent prices, legal promises, or health/payment/ID collection.
- Do not duplicate an existing FAQ question or service chip if the answer only restates what is already known — prefer updating via FAQ if it is genuinely new.
- Use Irish/UK plain English.`;

  const user = [
    `Gap on a call: ${input.gapSummary}`,
    input.callerContext?.trim()
      ? `Caller context: ${wrapUserContentForPrompt("CALLER_CONTEXT", input.callerContext.trim())}`
      : null,
    `Cara asked the owner: ${input.caraQuestion}`,
    `Owner answer: ${wrapUserContentForPrompt("OWNER_ANSWER", ownerAnswer)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let raw: string;
  try {
    raw = await completeOpenRouterChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      maxTokens: 600,
    });
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Could not draft an update right now.",
    };
  }

  const patch = parseDraftJson(raw);
  if (!patch) {
    return {
      ok: false,
      message: "Cara could not draft a structured update. Try rephrasing your answer.",
    };
  }

  return { ok: true, patch };
}

/** First clarifying question when the owner starts teaching Cara manually. */
export async function draftOwnerInitiatedQuestion(input: {
  businessName: string;
  ownerDescription: string;
}): Promise<{ ok: true; question: string; gapSummary: string } | { ok: false; message: string }> {
  const description = input.ownerDescription.trim();
  if (!description) {
    return { ok: false, message: "Describe what callers ask about or what Cara got wrong." };
  }

  const system = `You are Cara training ${input.businessName}. The owner wants to teach you something new for phone calls.
Reply with JSON only: {"gap_summary":"short topic label","cara_question":"one plain-English question for the owner in first person (I need to know…)"}
Keep cara_question under 300 characters.`;

  let raw: string;
  try {
    raw = await completeOpenRouterChat({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: wrapUserContentForPrompt("OWNER_DESCRIPTION", description),
        },
      ],
      temperature: 0.3,
      maxTokens: 300,
    });
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Could not start training right now.",
    };
  }

  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("parse");
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    const gapSummary = String(parsed.gap_summary ?? description).trim();
    const caraQuestion = String(parsed.cara_question ?? "").trim();
    if (!caraQuestion) throw new Error("parse");
    return { ok: true, question: caraQuestion, gapSummary };
  } catch {
    return {
      ok: true,
      question: `What should I tell callers about this? Please describe what you offer or how you handle it.`,
      gapSummary: description.slice(0, 200),
    };
  }
}

/** Template question for Action Inbox unclear / follow-up tickets. */
export function actionInboxTrainingQuestion(summary: string): {
  gapSummary: string;
  caraQuestion: string;
} {
  const gapSummary = summary.trim().slice(0, 500) || "Caller request Cara could not resolve";
  return {
    gapSummary,
    caraQuestion:
      "I took a message because I wasn't sure how to handle this. What should I tell callers in this situation?",
  };
}
