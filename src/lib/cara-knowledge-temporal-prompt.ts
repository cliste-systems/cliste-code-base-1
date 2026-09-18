import {
  businessRuleKnowledgeEntryId,
  faqKnowledgeEntryId,
  notOfferedKnowledgeEntryId,
} from "@/lib/cara-knowledge-index";
import {
  formatAgentKnowledgeList,
  parseAgentKnowledgeList,
} from "@/lib/agent-knowledge-format";
import type { TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import {
  formatExactTemporalMoment,
  isTemporalUpdateEffective,
} from "@/lib/cara-knowledge-temporal";

const TEMPORAL_INSTRUCTION =
  "Temporary updates below override the usual facts while active — including opening hours, prices, availability, and items on the don't-offer list. When one ends, use the current normal information again — never an outdated copy.";

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
}

function temporalUpdateOverridesNotOfferedItem(
  update: TemporalUpdateRecord,
  item: string,
): boolean {
  if (update.subjectRef === notOfferedKnowledgeEntryId(item)) return true;
  if (update.subjectType !== "price" && update.subjectType !== "availability") {
    return false;
  }
  const itemWords = significantWords(item);
  if (itemWords.length === 0) return false;
  const haystack = `${update.title} ${update.body}`.toLowerCase();
  return itemWords.some((word) => haystack.includes(word));
}

function temporalBusinessRuleLine(row: TemporalUpdateRecord): string {
  const body = row.body.trim();
  if (row.subjectType === "opening_hours") {
    return `TEMPORARY OPENING HOURS (override today's schedule): ${body}`;
  }
  if (row.subjectType === "price" || row.subjectType === "availability") {
    return `TEMPORARY OFFER (overrides usual availability/pricing): ${body}`;
  }
  return body;
}

export function applyTemporalFaqOverrides(
  faqs: { question: string; answer: string }[],
  updates: TemporalUpdateRecord[],
  now: Date = new Date(),
): { question: string; answer: string }[] {
  const effective = updates.filter((row) => isTemporalUpdateEffective(row, now));
  if (effective.length === 0) return faqs;

  const faqId = (question: string) => faqKnowledgeEntryId(question);
  return faqs.map((faq) => {
    const override = effective.find(
      (row) => row.subjectType === "faq" && row.subjectRef === faqId(faq.question),
    );
    if (!override) return faq;
    return { ...faq, answer: override.body };
  });
}

export function applyTemporalBusinessRuleOverrides(
  rules: string[],
  updates: TemporalUpdateRecord[],
  now: Date = new Date(),
): string[] {
  const effective = updates.filter((row) => isTemporalUpdateEffective(row, now));
  if (effective.length === 0) return rules;

  let merged = [...rules];

  for (const row of effective) {
    const body = row.body.trim();
    if (!body) continue;

    if (row.subjectType === "business_rule" && row.subjectRef) {
      const index = merged.findIndex(
        (rule) => businessRuleKnowledgeEntryId(rule) === row.subjectRef,
      );
      if (index >= 0) {
        merged[index] = body;
        continue;
      }
    }

    const line = temporalBusinessRuleLine(row);
    merged = merged.filter((rule) => rule.toLowerCase() !== line.toLowerCase());
    merged.unshift(line);
  }

  return merged;
}

export function applyTemporalServicesNotOfferedOverrides(
  notOfferedRaw: string | undefined,
  updates: TemporalUpdateRecord[],
  now: Date = new Date(),
): string | undefined {
  const items = parseAgentKnowledgeList(String(notOfferedRaw ?? ""));
  if (items.length === 0) return notOfferedRaw?.trim() || undefined;

  const effective = updates.filter((row) => isTemporalUpdateEffective(row, now));
  if (effective.length === 0) return notOfferedRaw?.trim() || undefined;

  const filtered = items.filter(
    (item) =>
      !effective.some((row) => temporalUpdateOverridesNotOfferedItem(row, item)),
  );

  if (filtered.length === items.length) {
    return notOfferedRaw?.trim() || undefined;
  }
  return filtered.length > 0 ? formatAgentKnowledgeList(filtered) : undefined;
}

export function buildTemporalKnowledgePromptSection(
  updates: TemporalUpdateRecord[],
  timezone: string,
  now: Date = new Date(),
): string | null {
  const effective = updates.filter((row) => isTemporalUpdateEffective(row, now));
  if (effective.length === 0) return null;

  const lines = effective.map((row) => {
    const preview = row.overridePreview;
    const validity = row.durationMode === "ongoing"
      ? "until ended"
      : row.expiresAt
        ? `until ${formatExactTemporalMoment(new Date(row.expiresAt), timezone)}`
        : "while active";
    if (preview?.normalBody) {
      return `• ${preview.temporaryLabel}: ${preview.temporaryBody} (${preview.scopeLabel}; ${validity}). Usual: ${preview.normalBody}. While active, ignore the usual version for this topic.`;
    }
    return `• ${row.title}: ${row.body} (${validity}). While active, this overrides the usual information for this topic.`;
  });

  return [TEMPORAL_INSTRUCTION, ...lines].join("\n");
}

export function activeTemporalSummaryForSubject(
  updates: TemporalUpdateRecord[],
  subjectRef: string,
  now: Date = new Date(),
): TemporalUpdateRecord | null {
  return (
    updates.find(
      (row) =>
        isTemporalUpdateEffective(row, now) &&
        row.subjectRef === subjectRef,
    ) ?? null
  );
}
