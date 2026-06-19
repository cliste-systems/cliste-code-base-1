import {
  BUSINESS_RULE_PRESETS,
  isBusinessRulePresetId,
  MAX_CUSTOM_BUSINESS_RULES,
} from "@/lib/business-rule-presets";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";

export const MAX_BUSINESS_RULES =
  BUSINESS_RULE_PRESETS.length + MAX_CUSTOM_BUSINESS_RULES;
export const MAX_BUSINESS_RULE_LENGTH = 200;

export const BUSINESS_RULES_SECTION_MARKER =
  "\n\n--- Important business rules ---\n";

export function normalizeBusinessRuleKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cleanBusinessRules(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const presets: string[] = [];
  const custom: string[] = [];
  const seenPreset = new Set<string>();
  const seenCustom = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (isBusinessRulePresetId(trimmed)) {
      if (!BUSINESS_RULE_PRESETS.some((p) => p.id === trimmed)) continue;
      if (seenPreset.has(trimmed)) continue;
      seenPreset.add(trimmed);
      presets.push(trimmed);
      continue;
    }

    const customText = trimmed.slice(0, MAX_BUSINESS_RULE_LENGTH);
    const violation = detectPromptInjectionViolation(customText);
    if (violation) continue;
    const key = normalizeBusinessRuleKey(customText);
    if (seenCustom.has(key)) continue;
    seenCustom.add(key);
    custom.push(customText);
    if (custom.length >= MAX_CUSTOM_BUSINESS_RULES) break;
  }

  return [...presets, ...custom];
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
