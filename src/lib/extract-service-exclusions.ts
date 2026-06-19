import "server-only";

import {
  formatAgentKnowledgeList,
  parseAgentKnowledgeList,
} from "@/lib/agent-knowledge-format";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";

const MAX_EXCLUSION_ITEMS = 12;
const MAX_RAW_LENGTH = 1200;

function parseExclusionsJson(raw: string): string[] | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const json = JSON.parse(trimmed.slice(start, end + 1)) as {
      exclusions?: unknown;
    };
    if (!Array.isArray(json.exclusions)) return null;
    const items = json.exclusions
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, MAX_EXCLUSION_ITEMS);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function normalizeExclusionChip(text: string): string {
  return text
    .trim()
    .replace(/^we\s+don'?t\s+(do|offer|take|handle)\s+/i, "")
    .replace(/^no\s+/i, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

export function fallbackExclusionChips(raw: string): string[] {
  return parseAgentKnowledgeList(raw)
    .map(normalizeExclusionChip)
    .filter(Boolean)
    .slice(0, MAX_EXCLUSION_ITEMS);
}

export type ExtractServiceExclusionsResult =
  | { ok: true; chips: string[]; formatted: string }
  | { ok: false; message: string };

/**
 * Extract short exclusion chips from a plain-English paragraph.
 * Falls back to parseAgentKnowledgeList when LLM is unavailable.
 */
export async function extractServiceExclusions(
  rawParagraph: string,
): Promise<ExtractServiceExclusionsResult> {
  const raw = rawParagraph.trim().slice(0, MAX_RAW_LENGTH);
  if (!raw) {
    return { ok: true, chips: [], formatted: "" };
  }

  try {
    const response = await completeOpenRouterChat({
      temperature: 0.1,
      maxTokens: 400,
      messages: [
        {
          role: "system",
          content: `You extract what a business does NOT offer from owner-written text for a phone assistant.
Return JSON only: {"exclusions":["short phrase",...]}
Rules:
- Short noun phrases only (e.g. "walk-ins", "hair services", "laser treatments").
- Strip "we don't", "no", etc. from each item.
- Only include things explicitly stated as not offered.
- Never invent exclusions. Max ${MAX_EXCLUSION_ITEMS} items.
- If nothing is clearly excluded, return {"exclusions":[]}.`,
        },
        {
          role: "user",
          content: raw,
        },
      ],
    });

    const parsed = parseExclusionsJson(response);
    const chips =
      parsed?.map(normalizeExclusionChip).filter(Boolean) ??
      fallbackExclusionChips(raw);

    return {
      ok: true,
      chips,
      formatted: formatAgentKnowledgeList(chips),
    };
  } catch {
    const chips = fallbackExclusionChips(raw);
    return {
      ok: true,
      chips,
      formatted: formatAgentKnowledgeList(chips),
    };
  }
}
