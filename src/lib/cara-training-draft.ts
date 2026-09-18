import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

import {
  type CaraTrainingPatch,
} from "./cara-training-types";
import type { TeachUnderstandingContext } from "./cara-training-understanding";

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
  teachingContext?: TeachUnderstandingContext | null;
};

/**
 * Turn the owner's plain-English answer into a structured Cara Setup patch.
 * Uses the teaching-stage understanding layer — clarified facts, not call scripts.
 */
export type DraftTrainingPatchResult =
  | { ok: true; patch: CaraTrainingPatch }
  | { ok: false; needsClarification: string }
  | { ok: false; message: string };

export async function draftTrainingPatchFromOwnerAnswer(
  input: DraftTrainingPatchInput,
): Promise<DraftTrainingPatchResult> {
  const { draftTrainingUnderstandingFromAnswer } = await import(
    "./cara-training-understanding"
  );

  const draft = await draftTrainingUnderstandingFromAnswer({
    gapSummary: input.gapSummary,
    callerContext: input.callerContext,
    caraQuestion: input.caraQuestion,
    ownerAnswer: input.ownerAnswer,
    knowledge: input.knowledge,
    teachingContext: input.teachingContext,
  });

  if (draft.ok) {
    return { ok: true, patch: draft.patch };
  }

  if ("needsClarification" in draft) {
    return { ok: false, needsClarification: draft.needsClarification };
  }

  return { ok: false, message: draft.message };
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
  const trimmed = summary.trim();
  const requestMatch = trimmed.match(/(?:^|\n)Request:\s*(.+)/i);
  const request = requestMatch?.[1]?.trim() ?? "";
  const header = trimmed.split("\n")[0]?.trim() ?? "";

  if (/\bcoin machine|change machine|exchange coins|change for cash\b/i.test(trimmed)) {
    return {
      gapSummary: "Coin machine / change for cash",
      caraQuestion:
        "Do we have a coin or change machine in store? What should I tell callers?",
    };
  }

  if (request) {
    return {
      gapSummary: request.slice(0, 200),
      caraQuestion: `A caller asked: "${request.slice(0, 180)}". What should I tell them?`,
    };
  }

  const gapSummary = header.slice(0, 500) || "Caller request Cara could not resolve";
  return {
    gapSummary,
    caraQuestion: request
      ? `A caller asked: "${request.slice(0, 180)}". What should I tell them?`
      : "What reusable information should Cara know for similar calls?",
  };
}
