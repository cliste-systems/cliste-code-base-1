export const CARA_TRAINING_GAP_KINDS = ["learnable", "live_info"] as const;

export type CaraTrainingGapKind = (typeof CARA_TRAINING_GAP_KINDS)[number];

const LIVE_INFO_PATTERNS: RegExp[] = [
  /\b(?:in|out of)\s+stock\b/i,
  /\bstock\s+(?:level|check|availability)\b/i,
  /\b(?:have you got|do you stock|got any)\b/i,
  /\bavailability\b/i,
  /\bhow much\b/i,
  /\b(?:price|prices|pricing|cost|costs)\b/i,
  /\b(?:today'?s|this (?:morning'?s|week'?s))\s+(?:specials?|offers?|deals?)\b/i,
  /\bspecials?\s+today\b/i,
  /\b(?:are you|you)\s+(?:still\s+)?open\s+(?:now|today|this evening)\b/i,
  /\bopen\s+now\b/i,
  /\bstill\s+open\b/i,
  /\b(?:wait(?:ing)?\s+time|how busy|queue)\b/i,
];

/** Opening-hours *schedule* is teachable; "are you open now" is live. */
const LEARNABLE_HOURS_OVERRIDE =
  /\b(?:opening hours|what (?:time|hours)|hours (?:are you|do you))\b/i;

export function isCaraTrainingGapKind(value: unknown): value is CaraTrainingGapKind {
  return (
    typeof value === "string" &&
    (CARA_TRAINING_GAP_KINDS as readonly string[]).includes(value)
  );
}

export function parseCaraTrainingGapKind(raw: unknown): CaraTrainingGapKind {
  return isCaraTrainingGapKind(raw) ? raw : "learnable";
}

/**
 * Classify a knowledge-gap topic. Live facts (stock, live prices, open-now)
 * must not become FAQs — Cara takes a message or transfers instead.
 */
export function classifyGapKind(
  ...parts: Array<string | null | undefined>
): CaraTrainingGapKind {
  const text = parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!text) return "learnable";

  if (LEARNABLE_HOURS_OVERRIDE.test(text) && !/\bopen now\b/i.test(text)) {
    const withoutHours = text.replace(LEARNABLE_HOURS_OVERRIDE, " ");
    if (!LIVE_INFO_PATTERNS.some((re) => re.test(withoutHours))) {
      return "learnable";
    }
  }

  return LIVE_INFO_PATTERNS.some((re) => re.test(text)) ? "live_info" : "learnable";
}
