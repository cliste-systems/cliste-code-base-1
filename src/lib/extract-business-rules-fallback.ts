import {
  cleanBusinessRules,
  multilineTextToRules,
} from "@/lib/agent-business-rules";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";

function normalizeRulePhrase(text: string): string {
  return text
    .trim()
    .replace(/^[-•*]\s+/, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

export function fallbackBusinessRules(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const fromNewlines = multilineTextToRules(trimmed);
  if (fromNewlines.length > 1) {
    return fromNewlines;
  }

  const fromList = parseAgentKnowledgeList(trimmed)
    .map(normalizeRulePhrase)
    .filter(Boolean);
  if (fromList.length > 1) {
    return cleanBusinessRules(fromList);
  }

  const fromSentences = trimmed
    .split(/(?<=[.!?])\s+|[;\n]+/)
    .map(normalizeRulePhrase)
    .filter((part) => part.length > 2);

  return cleanBusinessRules(fromSentences);
}

export function formatBusinessRulesList(rules: string[]): string {
  return rules.join("\n");
}
