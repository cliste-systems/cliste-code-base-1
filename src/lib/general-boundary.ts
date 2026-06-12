/**
 * General tab validation: anything-else lint, legacy blob triage, hours helpers.
 */

import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { detectCanonicalQuestion } from "@/lib/answers-boundary";
import { stripBusinessRulesFromSummary } from "@/lib/agent-business-rules";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  type WeekSchedule,
  weekScheduleHasOpenDay,
} from "@/lib/business-hours";
import { GREETING_LEGAL_OVERLAP_PATTERN } from "@/lib/voice-greeting-guardrails";
import {
  buildFullVoiceGreeting,
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  voiceLegalDisclosure,
} from "@/lib/voice-greeting";

export const HOURS_NOTE_MAX_LENGTH = 120;

export const HOURS_NEVER_CONFIGURED_INSTRUCTION =
  "Opening hours have not been provided yet. When callers ask about hours, I say I'll need to check with the team and take their details — I never guess.";

export const HOURS_ALL_CLOSED_INSTRUCTION =
  "We're closed every day according to the saved schedule. When callers ask about hours, I say so plainly.";

export const HOURS_OPEN_24_7_INSTRUCTION =
  "We're open 24 hours a day, 7 days a week.";

export const HOURS_CLOSED_DAY_INSTRUCTION =
  "When a caller asks about a day we're closed, I give the next time we're open rather than only saying we're closed.";

const SERVICES_LIST_PATTERN =
  /\b(?:we offer|services include|we provide|we do)\b/i;
const AREAS_LIST_PATTERN =
  /\b(?:areas covered|we cover|service area|areas we)\b/i;
const HOURS_TEXT_PATTERN =
  /\b(?:opening hours|open mon|closed mon|mon–fri|mon-fri)\b/i;
const FAQ_BLOCK_PATTERN = /(?:^|\n)\s*(?:q:|question:|if asked)/i;
const IDENTITY_LINE_PATTERN =
  /\b(?:i'?m cara|ai assistant|phone assistant)\b/i;

export type AnythingElseLint = {
  id: string;
  message: string;
  href?: string;
};

export type LegacyBlobMigrationInput = {
  businessKnowledgeSummary?: string | null;
  customPrompt?: string | null;
  servicesOffered?: string;
  servicesNotOffered?: string;
  openingHours?: string;
  serviceArea?: string;
  faqs?: AgentFaq[];
  businessName?: string;
  assistantDisplayName?: string;
};

function normaliseForCompare(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripKnownBlobSections(text: string): string {
  let out = text.trim();
  if (!out) return "";

  out = out
    .replace(/\n*Services and request types we handle include:[\s\S]*?(?=\n\n|\nOpening|\nAreas|$)/i, "")
    .replace(/\n*We offer:[\s\S]*?(?=\n\n|\nWe don't|\nOpening|$)/i, "")
    .replace(/\n*We don't offer:[\s\S]*?(?=\n\n|\nOpening|$)/i, "")
    .replace(/\n*Opening hours:[^\n]*/gi, "")
    .replace(/\n*Areas covered:[^\n]*/gi, "")
    .replace(/\n*Common questions:[\s\S]*/i, "")
    .replace(/If asked "[^"]+",[^\n]*(?:\n(?!If asked)[^\n]*)*/gi, "")
    .replace(/\n*If I'm unsure about anything[^\n]*(?:\n[^\n]*)*/i, "")
    .trim();

  const introMatch = out.match(/^i'?m cara[^\n]*\n?/i);
  if (introMatch) {
    out = out.slice(introMatch[0].length).trim();
  }

  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function listOverlapsBlob(listText: string | undefined, blob: string): boolean {
  const items = parseAgentKnowledgeList(listText ?? "");
  if (items.length === 0) return false;
  const haystack = normaliseForCompare(blob);
  const hits = items.filter((item) => {
    const needle = normaliseForCompare(item);
    return needle.length >= 4 && haystack.includes(needle);
  });
  return hits.length >= Math.min(2, items.length);
}

/**
 * Carry over only legacy blob content not represented in structured fields.
 */
export function migrateLegacyCaraBlobs(
  org: LegacyBlobMigrationInput | null | undefined,
): string {
  const fromSummary = stripBusinessRulesFromSummary(
    String(org?.businessKnowledgeSummary ?? ""),
  ).trim();
  const legacyPrompt = String(org?.customPrompt ?? "").trim();
  const source = fromSummary || legacyPrompt;
  if (!source) return "";

  let text = stripKnownBlobSections(source);

  if (listOverlapsBlob(org?.servicesOffered, source)) {
    text = text
      .replace(/\n*Services and request types we handle include:[\s\S]*?(?=\n\n|$)/i, "")
      .replace(/\n*We offer:[\s\S]*?(?=\n\n|$)/i, "")
      .trim();
  }

  if (listOverlapsBlob(org?.servicesNotOffered, source)) {
    text = text.replace(/\n*We don't offer:[\s\S]*?(?=\n\n|$)/i, "").trim();
  }

  if (org?.openingHours?.trim() && HOURS_TEXT_PATTERN.test(source)) {
    text = text.replace(/\n*Opening hours:[^\n]*/gi, "").trim();
  }

  if (listOverlapsBlob(org?.serviceArea, source)) {
    text = text.replace(/\n*Areas covered:[^\n]*/gi, "").trim();
  }

  if ((org?.faqs ?? []).some((f) => f.question.trim()) && FAQ_BLOCK_PATTERN.test(source)) {
    text = text.replace(/\n*Common questions:[\s\S]*/i, "").trim();
    text = text
      .replace(/If asked "[^"]+",[^\n]*(?:\n(?!If asked)[^\n]*)*/gi, "")
      .trim();
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function anythingElseLooksLikeLegacyBlob(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    SERVICES_LIST_PATTERN.test(trimmed) ||
    AREAS_LIST_PATTERN.test(trimmed) ||
    HOURS_TEXT_PATTERN.test(trimmed) ||
    FAQ_BLOCK_PATTERN.test(trimmed) ||
    IDENTITY_LINE_PATTERN.test(trimmed)
  );
}

export function lintAnythingElse(text: string): AnythingElseLint[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const warnings: AnythingElseLint[] = [];

  if (HOURS_TEXT_PATTERN.test(trimmed)) {
    warnings.push({
      id: "ae-hours",
      message:
        "This looks like opening hours — Cara already knows those from Opening hours.",
      href: "/dashboard/cara-setup/general",
    });
  }

  if (SERVICES_LIST_PATTERN.test(trimmed)) {
    warnings.push({
      id: "ae-services",
      message:
        "This looks like a services list — move it to Services instead.",
      href: "/dashboard/cara-setup/services",
    });
  }

  if (AREAS_LIST_PATTERN.test(trimmed)) {
    warnings.push({
      id: "ae-areas",
      message:
        "This looks like a service area list — Cara already knows your areas.",
      href: "/dashboard/cara-setup/general",
    });
  }

  if (FAQ_BLOCK_PATTERN.test(trimmed)) {
    warnings.push({
      id: "ae-faq",
      message: "This looks like common questions — move them to Answers.",
      href: "/dashboard/cara-setup/answers",
    });
  }

  if (IDENTITY_LINE_PATTERN.test(trimmed)) {
    warnings.push({
      id: "ae-identity",
      message:
        "Cara's introduction is set under Voice & greeting — remove duplicate lines here.",
      href: "/dashboard/cara-setup/general",
    });
  }

  for (const line of trimmed.split("\n")) {
    const question = line.replace(/^(q:|question:)\s*/i, "").trim();
    if (detectCanonicalQuestion(question)) {
      warnings.push({
        id: `ae-canonical-${question}`,
        message:
          "A line looks like a question Cara already answers from setup — review and trim.",
        href: "/dashboard/cara-setup/general",
      });
      break;
    }
  }

  return warnings;
}

export function ensureCompliantStoredGreeting(input: {
  greeting: string;
  businessName: string;
  assistantDisplayName: string;
}): string {
  const assistant = input.assistantDisplayName.trim() || "Cara";
  const defaultIntro = defaultVoiceGreetingIntro(input.businessName);
  const { intro, closing } = parseGreetingParts(
    input.greeting,
    assistant,
    defaultIntro,
  );
  const assembled = buildFullVoiceGreeting(intro, assistant, closing);
  const legal = voiceLegalDisclosure(assistant);
  if (!assembled.includes(legal)) {
    return buildFullVoiceGreeting(defaultIntro, assistant, closing);
  }
  return assembled;
}

export function greetingMissingDisclosure(
  greeting: string,
  assistantDisplayName: string,
): boolean {
  const legal = voiceLegalDisclosure(assistantDisplayName);
  const text = greeting.trim();
  if (!text.includes(legal)) return true;
  return !GREETING_LEGAL_OVERLAP_PATTERN.test(text);
}

export function buildHoursPromptBlock(input: {
  neverConfigured: boolean;
  open24_7: boolean;
  schedule: WeekSchedule;
  formattedHours: string;
  note?: string;
}): string | null {
  if (input.neverConfigured) {
    return HOURS_NEVER_CONFIGURED_INSTRUCTION;
  }

  if (input.open24_7) {
    const parts = [HOURS_OPEN_24_7_INSTRUCTION];
    if (input.note?.trim()) parts.push(input.note.trim());
    return parts.join(" ");
  }

  if (!weekScheduleHasOpenDay(input.schedule)) {
    return HOURS_ALL_CLOSED_INSTRUCTION;
  }

  if (!input.formattedHours.trim()) return HOURS_NEVER_CONFIGURED_INSTRUCTION;

  const parts = [`Our opening hours are:\n${input.formattedHours.trim()}`];
  if (input.note?.trim()) {
    parts.push(`Hours note: ${input.note.trim()}`);
  }
  parts.push(HOURS_CLOSED_DAY_INSTRUCTION);
  return parts.join("\n\n");
}
