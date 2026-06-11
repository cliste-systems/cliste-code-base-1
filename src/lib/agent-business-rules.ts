export const MAX_BUSINESS_RULES = 15;
export const MAX_BUSINESS_RULE_LENGTH = 200;

export const BUSINESS_RULES_SECTION_MARKER =
  "\n\n--- Important business rules ---\n";

export function normalizeBusinessRuleKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cleanBusinessRules(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, MAX_BUSINESS_RULE_LENGTH);
    if (!trimmed) continue;
    const key = normalizeBusinessRuleKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_BUSINESS_RULES) break;
  }
  return out;
}

export function parseAgentBusinessRules(value: unknown): string[] {
  return cleanBusinessRules(value);
}

export function rulesToMultilineText(rules: string[]): string {
  return rules.join("\n");
}

export function multilineTextToRules(text: string): string[] {
  return cleanBusinessRules(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

export function stripBusinessRulesFromSummary(summary: string): string {
  const idx = summary.indexOf(BUSINESS_RULES_SECTION_MARKER);
  if (idx === -1) return summary.trim();
  return summary.slice(0, idx).trim();
}

export function stitchBusinessRulesIntoSummary(
  summary: string,
  rules: string[],
): string {
  const base = stripBusinessRulesFromSummary(summary);
  const cleaned = cleanBusinessRules(rules);
  if (cleaned.length === 0) return base;
  return `${base}${BUSINESS_RULES_SECTION_MARKER}${cleaned.join("\n")}`.trim();
}
