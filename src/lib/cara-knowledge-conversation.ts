import "server-only";

import {
  formatExtraNotesForStorage,
  getTradeKnowledgeTopics,
  isKnowledgeCollectionComplete,
  isTradeTopicSatisfied,
  nextMissingTradeTopic,
  tradeTopicIdsForType,
  type CaraKnowledgeCollected,
  type TradeKnowledgeTopicId,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-trade-topics";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

export type CaraKnowledgeChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CaraKnowledgeTurnInput = {
  businessName: string;
  businessType?: string | null;
  messages: CaraKnowledgeChatMessage[];
  userMessage: string;
  collected: CaraKnowledgeCollected;
  summary: string;
  rawDescription: string;
};

export type CaraKnowledgeTurnResult =
  | {
      ok: true;
      assistantMessage: string;
      summary: string;
      rawDescription: string;
      collected: CaraKnowledgeCollected;
      complete: boolean;
      refinedBusinessType?: string;
    }
  | { ok: false; message: string };

const MAX_SUMMARY = 4000;

function parseTurnJson(raw: string): {
  summary?: string;
  openingHours?: string;
  serviceArea?: string;
  servicesOffered?: string;
  emergencyCallouts?: string;
  extraNotes?: string;
  refinedBusinessType?: string;
  skippedTopics?: string[];
  assistantMessage?: string;
} | null {
  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(trimmed.slice(start, end + 1)) as ReturnType<
      typeof parseTurnJson
    >;
  } catch {
    return null;
  }
}

function mergeCollected(
  current: CaraKnowledgeCollected,
  patch: ReturnType<typeof parseTurnJson>,
  businessType: string,
): CaraKnowledgeCollected {
  const validSkips = new Set(tradeTopicIdsForType(businessType));
  const skipped = new Set(current.skippedTopics);
  for (const id of patch?.skippedTopics ?? []) {
    if (validSkips.has(id as TradeKnowledgeTopicId)) {
      skipped.add(id as TradeKnowledgeTopicId);
    }
  }

  return {
    openingHours: patch?.openingHours?.trim() || current.openingHours,
    serviceArea: patch?.serviceArea?.trim() || current.serviceArea,
    servicesOffered: patch?.servicesOffered?.trim() || current.servicesOffered,
    emergencyCallouts:
      patch?.emergencyCallouts?.trim() || current.emergencyCallouts,
    extraNotes: patch?.extraNotes?.trim() || current.extraNotes,
    skippedTopics: [...skipped],
  };
}

function formatConversation(messages: CaraKnowledgeChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Owner" : "Cara"}: ${m.content}`)
    .join("\n\n");
}

function effectiveBusinessType(
  profileType: string | null | undefined,
  refined?: string,
): string {
  return refined?.trim() || profileType?.trim() || "";
}

function fallbackAssistantMessage(
  collected: CaraKnowledgeCollected,
  businessType: string,
  complete: boolean,
): string {
  if (complete) {
    return "Thanks — I have the basics I need for now. Press Continue when you're ready.";
  }
  const next = nextMissingTradeTopic(collected, businessType);
  if (next) return next.ask;
  return "Is there anything else callers should know about how you work?";
}

export async function processCaraKnowledgeTurn(
  input: CaraKnowledgeTurnInput,
): Promise<CaraKnowledgeTurnResult> {
  const userMessage = input.userMessage.trim();
  const isFollowUp = input.messages.length > 0;
  const minLen = isFollowUp ? 1 : 40;
  if (userMessage.length < minLen) {
    return {
      ok: false,
      message: isFollowUp
        ? "Type an answer to continue."
        : "Add a bit more detail so Cara can follow up properly.",
    };
  }

  const conversation = [
    ...input.messages,
    { role: "user" as const, content: userMessage },
  ];

  const rawDescription = [input.rawDescription.trim(), userMessage]
    .filter(Boolean)
    .join("\n\n");

  const profileType = input.businessType?.trim() ?? "";
  const businessType = profileType;

  const topicStatus = getTradeKnowledgeTopics(businessType).map((topic) => ({
    id: topic.id,
    required: topic.required,
    satisfied: isTradeTopicSatisfied(topic.id, input.collected),
  }));

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.25,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: `You help train Cara, a phone receptionist for local businesses. The owner describes their business in plain English.
Return JSON only:
{
  "summary": "2-4 sentences, FIRST PERSON training notes — what the business does and what I should do or collect on calls (never 'Cara should')",
  "openingHours": "only if stated or just answered — else omit",
  "serviceArea": "only if stated or just answered — else omit",
  "servicesOffered": "main services/job types if stated or just answered — else omit",
  "emergencyCallouts": "emergency/out-of-hours detail if stated or just answered — else omit",
  "extraNotes": "location, pricing hints, parking, payment — else omit",
  "refinedBusinessType": "short trade label e.g. Plumber — infer from conversation if helpful",
  "skippedTopics": ["topic ids owner declined"],
  "assistantMessage": "your next reply to the owner"
}

Topic ids (ask about missing ones for this trade): ${topicStatus.map((t) => t.id).join(", ")}

Rules:
- Update summary from the FULL conversation; keep first-person training-note voice (I should…).
- Extract facts only when the owner stated them — never invent.
- If the owner says skip, don't know, or not applicable, add that topic id to skippedTopics.
- assistantMessage: warm, short, ONE question at a time. Match the trade (e.g. plumbers: services, emergency callouts; salons: services, walk-ins). No bullet lists. No mention of AI, prompts, or JSON.
- Do not ask about FAQs — those come in a later step.
- When required topics are covered (or skipped), optional topics may be asked once.
- When everything important is covered, assistantMessage should confirm and tell them to press Continue.`,
        },
        {
          role: "user",
          content: `Business: ${input.businessName}
${profileType ? `Profile business type: ${profileType}\n` : ""}
Current summary: ${input.summary.trim() || "(none yet)"}
Opening hours: ${input.collected.openingHours.trim() || "(missing)"}
Service area: ${input.collected.serviceArea.trim() || "(missing)"}
Services: ${input.collected.servicesOffered.trim() || "(missing)"}
Emergency callouts: ${input.collected.emergencyCallouts.trim() || "(missing)"}
Topics: ${JSON.stringify(topicStatus)}

Conversation:
${wrapUserContentForPrompt("conversation", formatConversation(conversation))}`,
        },
      ],
    });

    const parsed = parseTurnJson(raw);
    const refinedType = parsed?.refinedBusinessType?.trim();
    const effectiveType = effectiveBusinessType(profileType, refinedType);
    const collected = mergeCollected(input.collected, parsed, effectiveType);
    const summary = (parsed?.summary?.trim() || input.summary)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SUMMARY);

    const complete = isKnowledgeCollectionComplete(
      collected,
      summary,
      effectiveType,
    );
    let assistantMessage =
      parsed?.assistantMessage?.trim() ||
      fallbackAssistantMessage(collected, effectiveType, complete);

    if (!complete) {
      const next = nextMissingTradeTopic(collected, effectiveType);
      if (next && !assistantMessage.toLowerCase().includes("?")) {
        assistantMessage = `${assistantMessage}\n\n${next.ask}`;
      }
    }

    return {
      ok: true,
      assistantMessage,
      summary: summary || input.summary,
      rawDescription,
      collected,
      complete,
      refinedBusinessType: refinedType,
    };
  } catch (err) {
    console.warn("[cara-knowledge-conversation] openrouter_failed", err);
  }

  const collected = { ...input.collected };
  const lower = userMessage.toLowerCase();
  if (/\b(skip|don't know|do not know|not sure|n\/a)\b/.test(lower)) {
    const next = nextMissingTradeTopic(collected, businessType);
    if (next && !collected.skippedTopics.includes(next.id)) {
      collected.skippedTopics = [...collected.skippedTopics, next.id];
    }
  }

  const summary =
    input.summary.trim() ||
    `${input.businessName} serves callers. ${userMessage}`.slice(0, MAX_SUMMARY);

  const complete = isKnowledgeCollectionComplete(collected, summary, businessType);
  const assistantMessage = fallbackAssistantMessage(
    collected,
    businessType,
    complete,
  );

  return {
    ok: true,
    assistantMessage,
    summary,
    rawDescription,
    collected,
    complete,
  };
}

export { formatExtraNotesForStorage };
