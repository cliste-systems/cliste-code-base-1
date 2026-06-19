/**
 * Classifies policy/style chips into Do vs Don't columns for dashboard UI.
 * Storage remains a flat string[] — polarity is derived from text.
 */

import { normalizeCaraSetupChip } from "@/lib/cara-setup-chips";
import { looksLikeBusinessPolicyRule } from "@/lib/call-handling-boundary";

export type RulePolarity = "do" | "dont";

const NEGATION_CUE =
  /^(?:never|don'?t|do not|no|not|avoid|without)\b|(?:don'?t|do not|never|no)\s+\w/i;

const DONT_PATTERNS: RegExp[] = [
  /^(?:never|don'?t|do not|no|not|avoid)\b/i,
  /\bnot\s+(?:taking|accepting|open)\b/i,
  /\b(?:closed|not open)\s+(?:on|for)\b/i,
  /\bno\s+walk-?ins?\b/i,
  /\b(?:don'?t|do not|never)\s+read\b/i,
  /\b(?:don'?t|do not|never)\s+guess\b/i,
];

const DO_PATTERNS: RegExp[] = [
  /^(?:always|use|keep|be|offer|confirm|ask|take|flag|mention)\b/i,
  /\buse\s+their\b/i,
  /\bkeep\s+(?:it\s+)?(?:answers?|replies?|responses?)\s+short\b/i,
  /\b(?:friendly|warm|professional|polite)\b/i,
  /\b(?:short|brief|concise)\s+(?:answers?|replies?)\b/i,
  /\bconfirm\s+spelling\b/i,
  /\balways\s+take\s+a\s+message\b/i,
];

function hasNegationCue(text: string): boolean {
  return NEGATION_CUE.test(text);
}

export function classifyRulePolarity(text: string): RulePolarity {
  const normalized = normalizeCaraSetupChip(text);
  if (!normalized) return "do";

  if (DONT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "dont";
  }

  if (looksLikeBusinessPolicyRule(normalized) && hasNegationCue(normalized)) {
    return "dont";
  }

  if (
    looksLikeBusinessPolicyRule(normalized) &&
    /\b(?:cancel|refund|deposit|discount|walk-?in|quote|price|payment|booking|hours?|opening)\b/i.test(
      normalized,
    )
  ) {
    return "dont";
  }

  if (DO_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "do";
  }

  if (hasNegationCue(normalized)) {
    return "dont";
  }

  return "do";
}

export function partitionRulesByPolarity(items: string[]): {
  do: string[];
  dont: string[];
} {
  const doItems: string[] = [];
  const dontItems: string[] = [];

  for (const item of items) {
    if (classifyRulePolarity(item) === "dont") {
      dontItems.push(item);
    } else {
      doItems.push(item);
    }
  }

  return { do: doItems, dont: dontItems };
}

export function normalizeRuleForPolarity(
  text: string,
  target: RulePolarity,
): string {
  const normalized = normalizeCaraSetupChip(text);
  if (!normalized) return "";

  if (target === "dont") {
    if (/^(?:don'?t|do not|never|no|not|avoid)\b/i.test(normalized)) {
      return normalized;
    }
    const lower = normalized.charAt(0).toLowerCase() + normalized.slice(1);
    return `Don't ${lower}`;
  }

  return normalized;
}
