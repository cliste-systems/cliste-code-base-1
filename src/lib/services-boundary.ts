/**
 * Niche-agnostic validation and lint helpers for Cara Setup service boundary lists.
 */

import {
  CARA_SETUP_CHIP_MAX_LENGTH,
  caraSetupChipKey,
  dedupeCaraSetupChips,
  findExactChipInList,
  findNearDuplicateChip,
  isCaraSetupChipTooLong,
  normalizeCaraSetupChip,
  splitCaraSetupChipInput,
} from "@/lib/cara-setup-chips";

export const SERVICE_CHIP_MAX_LENGTH = CARA_SETUP_CHIP_MAX_LENGTH;

export type ServiceListKind = "offered" | "excluded";

export type ExclusionConflict = {
  exclusion: string;
  location: "faq" | "anythingElse";
  label: string;
  excerpt: string;
};

export type ServiceConflictWarning = ExclusionConflict & {
  message: string;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "any",
  "are",
  "for",
  "from",
  "have",
  "just",
  "not",
  "offer",
  "offers",
  "only",
  "that",
  "the",
  "this",
  "with",
  "your",
]);

const NEGATION_PATTERNS: RegExp[] = [
  /\bnot\b/i,
  /\bdon'?t\b/i,
  /\bdo not\b/i,
  /\bexcept\b/i,
  /\bbut not\b/i,
  /\beverything but\b/i,
  /\bno\s+[a-z]/i,
];

export const normalizeServiceChip = normalizeCaraSetupChip;
export const serviceChipKey = caraSetupChipKey;
export const dedupeServiceChips = dedupeCaraSetupChips;
export const findExactInList = findExactChipInList;
export const findNearDuplicate = findNearDuplicateChip;
export const splitServiceChipInput = splitCaraSetupChipInput;
export const isServiceChipTooLong = isCaraSetupChipTooLong;

export function crossListConflictMessage(
  kind: ServiceListKind,
): string {
  return kind === "offered"
    ? "Already in What you don't offer — remove it there first."
    : "Already in What you offer — remove it there first.";
}

export function looksLikeExclusion(item: string): boolean {
  const text = normalizeServiceChip(item);
  if (!text) return false;
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text));
}

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

function textMentionsExclusion(text: string, exclusion: string): boolean {
  const haystack = text.toLowerCase();
  const needle = normalizeServiceChip(exclusion).toLowerCase();
  if (!needle) return false;

  if (needle.length >= 5 && haystack.includes(needle)) return true;

  const words = significantWords(exclusion);
  if (words.length === 0) return false;

  const hits = words.filter((word) => haystack.includes(word));
  if (words.length === 1) return hits.length === 1;
  return hits.length >= 2;
}

export function lintExclusionConflicts(
  exclusions: string[],
  faqs: { question: string; answer: string }[],
  anythingElse: string,
): ExclusionConflict[] {
  const conflicts: ExclusionConflict[] = [];
  const extra = anythingElse.trim();

  for (const exclusion of dedupeServiceChips(exclusions)) {
    for (const faq of faqs) {
      const answer = faq.answer.trim();
      if (!answer) continue;
      if (textMentionsExclusion(answer, exclusion)) {
        conflicts.push({
          exclusion,
          location: "faq",
          label: faq.question.trim() || "Common question",
          excerpt:
            answer.length > 120 ? `${answer.slice(0, 117)}…` : answer,
        });
      }
    }

    if (extra && textMentionsExclusion(extra, exclusion)) {
      conflicts.push({
        exclusion,
        location: "anythingElse",
        label: "Anything else Cara should know",
        excerpt: extra.length > 120 ? `${extra.slice(0, 117)}…` : extra,
      });
    }
  }

  return conflicts;
}

export function formatExclusionConflictWarning(
  conflict: ExclusionConflict,
): string {
  return `Possible conflict: you've excluded "${conflict.exclusion}" but ${conflict.location === "faq" ? `the answer to "${conflict.label}"` : conflict.label} mentions it — Cara may contradict herself.`;
}

export function buildServiceConflictWarnings(
  exclusions: string[],
  faqs: { question: string; answer: string }[],
  anythingElse: string,
): ServiceConflictWarning[] {
  return lintExclusionConflicts(exclusions, faqs, anythingElse).map(
    (conflict) => ({
      ...conflict,
      message: formatExclusionConflictWarning(conflict),
    }),
  );
}

/** Prompt block when no services are listed yet. */
export const EMPTY_OFFER_LIST_INSTRUCTION =
  "You haven't listed services yet, so I don't confirm or rule out any work — for job-related calls I take their name, number, and what they need, and pass it to your Action Inbox.";

export const CATEGORY_MATCHING_INSTRUCTION =
  "Callers won't use your exact category names — I use common sense to match what they mean to your lists. If I'm genuinely stuck, I don't guess: I take their name, number, and request for the Action Inbox.";

export const SPECIFIC_BEATS_BROAD_INSTRUCTION =
  "If something could fit both lists, the more specific entry wins — a don't-offer item beats a broad offer.";

export const MIXED_REQUEST_INSTRUCTION =
  "If they ask about several things at once, I handle each part in one go — what you do, what you don't, and a message for anything I'm unsure about.";
