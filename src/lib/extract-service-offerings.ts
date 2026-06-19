import "server-only";

import {
  formatAgentKnowledgeList,
  parseAgentKnowledgeList,
} from "@/lib/agent-knowledge-format";
import { dedupeCaraSetupChips } from "@/lib/cara-setup-chips";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";

const MAX_OFFERING_ITEMS = 20;
const MAX_RAW_LENGTH = 1500;

function parseOfferingsJson(raw: string): string[] | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const json = JSON.parse(trimmed.slice(start, end + 1)) as {
      offerings?: unknown;
    };
    if (!Array.isArray(json.offerings)) return null;
    const items = json.offerings
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, MAX_OFFERING_ITEMS);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function normalizeOfferingChip(text: string): string {
  return text
    .trim()
    .replace(/^we\s+(do|offer|provide|take)\s+/i, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

export function fallbackOfferingChips(raw: string): string[] {
  return parseAgentKnowledgeList(raw)
    .map(normalizeOfferingChip)
    .filter(Boolean)
    .slice(0, MAX_OFFERING_ITEMS);
}

export type ExtractServiceOfferingsResult =
  | { ok: true; chips: string[]; formatted: string }
  | { ok: false; message: string };

/**
 * Extract short service/offering chips from a plain-English paragraph.
 * Falls back to parseAgentKnowledgeList when LLM is unavailable.
 */
export async function extractServiceOfferings(
  rawParagraph: string,
): Promise<ExtractServiceOfferingsResult> {
  const raw = rawParagraph.trim().slice(0, MAX_RAW_LENGTH);
  if (!raw) {
    return { ok: true, chips: [], formatted: "" };
  }

  try {
    const response = await completeOpenRouterChat({
      temperature: 0.1,
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content: `You extract services, treatments, or jobs a business OFFERS from owner-written text for a phone assistant.
Return JSON only: {"offerings":["short phrase",...]}
Rules:
- Short noun phrases only (e.g. "gel manicures", "skin fades", "boiler repairs").
- Only include things explicitly stated as offered.
- Never invent services. Max ${MAX_OFFERING_ITEMS} items.
- If nothing is clearly offered, return {"offerings":[]}.`,
        },
        {
          role: "user",
          content: raw,
        },
      ],
    });

    const parsed = parseOfferingsJson(response);
    const chips = dedupeCaraSetupChips(
      parsed?.map(normalizeOfferingChip).filter(Boolean) ??
        fallbackOfferingChips(raw),
    );

    return {
      ok: true,
      chips,
      formatted: formatAgentKnowledgeList(chips),
    };
  } catch {
    const chips = dedupeCaraSetupChips(fallbackOfferingChips(raw));
    return {
      ok: true,
      chips,
      formatted: formatAgentKnowledgeList(chips),
    };
  }
}
