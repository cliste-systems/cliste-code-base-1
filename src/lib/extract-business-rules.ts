import "server-only";

import {
  cleanBusinessRules,
  MAX_BUSINESS_RULES,
} from "@/lib/agent-business-rules";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";

import {
  fallbackBusinessRules,
  formatBusinessRulesList,
} from "./extract-business-rules-fallback";

const MAX_RAW_LENGTH = 1200;

function parseRulesJson(raw: string): string[] | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const json = JSON.parse(trimmed.slice(start, end + 1)) as {
      rules?: unknown;
    };
    if (!Array.isArray(json.rules)) return null;
    const items = cleanBusinessRules(json.rules);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export type ExtractBusinessRulesResult =
  | { ok: true; rules: string[]; formatted: string }
  | { ok: false; message: string };

/**
 * Extract short business rules from a plain-English paragraph.
 * Falls back to heuristic parsing when LLM is unavailable.
 */
export async function extractBusinessRules(
  rawParagraph: string,
): Promise<ExtractBusinessRulesResult> {
  const raw = rawParagraph.trim().slice(0, MAX_RAW_LENGTH);
  if (!raw) {
    return { ok: true, rules: [], formatted: "" };
  }

  try {
    const response = await completeOpenRouterChat({
      temperature: 0.1,
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content: `You extract business rules for a phone assistant from owner-written text.
Return JSON only: {"rules":["short rule",...]}
Rules:
- Each item is one clear rule Cara can follow on calls (imperative or short statement).
- Keep owner wording where possible; strip filler only.
- Only include rules explicitly stated. Never invent rules.
- Max ${MAX_BUSINESS_RULES} items.
- If nothing is clearly a rule, return {"rules":[]}.`,
        },
        {
          role: "user",
          content: raw,
        },
      ],
    });

    const parsed = parseRulesJson(response);
    const rules = parsed ?? fallbackBusinessRules(raw);

    return {
      ok: true,
      rules,
      formatted: formatBusinessRulesList(rules),
    };
  } catch {
    const rules = fallbackBusinessRules(raw);
    return {
      ok: true,
      rules,
      formatted: formatBusinessRulesList(rules),
    };
  }
}
