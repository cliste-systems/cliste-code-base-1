import {
  cleanBusinessRules,
  MAX_BUSINESS_RULE_LENGTH,
  MAX_BUSINESS_RULES,
} from "@/lib/agent-business-rules";

export const MAX_CARA_RULES = MAX_BUSINESS_RULES;
export const MAX_CARA_RULE_LENGTH = MAX_BUSINESS_RULE_LENGTH;

export function cleanCaraRules(value: unknown): string[] {
  return cleanBusinessRules(value);
}

export function parseAgentCaraRules(value: unknown): string[] {
  return cleanCaraRules(value);
}
