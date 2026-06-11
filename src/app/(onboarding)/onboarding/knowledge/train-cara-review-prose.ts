/** Natural-language helpers for the review read-back (Cara's POV, not raw form fields). */

import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";

import { parseReviewChipList } from "./train-cara-review-display";
import { polishFaqAnswer } from "./train-cara-review-polish";

function stripTrailingPunctuation(text: string): string {
  return text.trim().replace(/[.!?,;:]+$/, "").trim();
}

function polishSpeechText(text: string): string {
  return text
    .replace(/\.,/g, ",")
    .replace(/,\./g, ",")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .trim();
}

export function joinNaturalLanguageList(items: string[]): string {
  const cleaned = items
    .map((item) => stripTrailingPunctuation(item))
    .filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNearDuplicate(a: string, b: string): boolean {
  const left = normalizeForCompare(a);
  const right = normalizeForCompare(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const wordsLeft = new Set(left.split(" ").filter(Boolean));
  const wordsRight = new Set(right.split(" ").filter(Boolean));
  const overlap = [...wordsLeft].filter((word) => wordsRight.has(word)).length;
  const union = new Set([...wordsLeft, ...wordsRight]).size;
  return union > 0 && overlap / union >= 0.72;
}

export function dedupeParagraphs(paragraphs: string[]): string[] {
  const kept: string[] = [];
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (kept.some((existing) => isNearDuplicate(existing, trimmed))) continue;
    kept.push(trimmed);
  }
  return kept;
}

export function aboutParagraphs(about: string): string[] {
  return dedupeParagraphs(
    about
      .trim()
      .split(/\n\n+/)
      .map((block) => block.trim())
      .filter(Boolean),
  );
}

export function isAlreadyCoveredElsewhere(
  text: string,
  elsewhere: string[],
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return elsewhere.some((block) => isNearDuplicate(trimmed, block));
}

export type ReviewSpeech = {
  intro: string;
  body: string;
};

function blendSentences(sentences: string[]): string {
  const parts = dedupeParagraphs(sentences)
    .map((sentence) => stripTrailingPunctuation(sentence))
    .filter(Boolean);

  const text = parts.map((part) => `${part}.`).join(" ");
  return polishSpeechText(text);
}

export function buildBlendedAboutSpeech(
  about: string,
  businessName: string,
): ReviewSpeech | null {
  const name = businessName.trim() || "your business";
  const paragraphs = aboutParagraphs(about);
  if (paragraphs.length === 0) return null;

  return {
    intro: `When someone asks what ${name} does, I'll say:`,
    body: blendSentences(paragraphs),
  };
}

export function buildReviewServicesSpeech(items: string[]): ReviewSpeech | null {
  const joined = joinNaturalLanguageList(items);
  if (!joined) return null;

  return {
    intro: "When someone asks what you can help with, I'll tell them:",
    body: `I can help with ${joined}.`,
  };
}

export function buildReviewExclusionsSpeech(items: string[]): ReviewSpeech | null {
  const joined = joinNaturalLanguageList(items);
  if (!joined) return null;

  return {
    intro: "If it's not something you take on, I'll say:",
    body: `I'll politely pass on ${joined} and point them elsewhere if I can.`,
  };
}

export function buildReviewAvailabilitySpeech(
  hours: string,
  coverage: string,
  about: string,
): ReviewSpeech | null {
  const alreadySaid = aboutParagraphs(about);
  const lines: string[] = [];

  if (hours.trim()) {
    const hourParts = hours
      .trim()
      .split(/\n+|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => narrateHoursLine(part));

    for (const part of dedupeParagraphs(hourParts)) {
      if (!isAlreadyCoveredElsewhere(part, alreadySaid)) {
        lines.push(part);
      }
    }
  }

  if (coverage.trim()) {
    const coverageLine = buildReviewCoverageLine(coverage);
    if (
      coverageLine &&
      !lines.some((line) => isNearDuplicate(line, coverageLine)) &&
      !isAlreadyCoveredElsewhere(coverageLine, alreadySaid) &&
      !isAlreadyCoveredElsewhere(coverage, alreadySaid)
    ) {
      lines.push(coverageLine);
    }
  }

  if (lines.length === 0) return null;

  return {
    intro: "When someone asks about hours or where you cover, I'll say:",
    body: blendSentences(lines),
  };
}

export function buildReviewCallsSpeech(
  captureDetails: string,
  rules: string[],
  about: string,
): ReviewSpeech | null {
  const alreadySaid = aboutParagraphs(about);
  const lines: string[] = [];

  const capture = buildReviewCaptureLine(captureDetails);
  if (capture && !isAlreadyCoveredElsewhere(capture, alreadySaid)) {
    lines.push(capture);
  }

  const rulesLine = buildReviewRulesLine(rules);
  if (
    rulesLine &&
    !lines.some((line) => isNearDuplicate(line, rulesLine)) &&
    !isAlreadyCoveredElsewhere(rulesLine, alreadySaid)
  ) {
    lines.push(rulesLine);
  }

  if (lines.length === 0) return null;

  return {
    intro: "On every call, here's what I'll do:",
    body: blendSentences(lines),
  };
}

export type ReviewFaqItem = {
  question: string;
  answer: string;
};

export function buildReviewFaqItems(faqs: AgentFaq[]): ReviewFaqItem[] {
  const items: ReviewFaqItem[] = [];

  for (const faq of faqs) {
    const question = stripTrailingPunctuation(faq.question);
    const answer = polishFaqAnswer(faq.answer);
    if (!question && !answer) continue;

    const item: ReviewFaqItem = {
      question,
      answer: answer || "I'll check with you before guessing.",
    };

    if (
      items.some(
        (existing) =>
          isNearDuplicate(existing.question, item.question) ||
          isNearDuplicate(existing.answer, item.answer),
      )
    ) {
      continue;
    }

    items.push(item);
  }

  return items;
}

export function buildReviewFaqsSpeech(faqs: AgentFaq[]): ReviewSpeech | null {
  const items = buildReviewFaqItems(faqs);
  if (items.length === 0) return null;

  return {
    intro: "Here's how I'll answer common questions:",
    body: "",
  };
}

function buildReviewCoverageLine(coverage: string): string {
  const text = coverage.trim();
  if (!text) return "";

  const normalized = text
    .replace(/^we cover\s+/i, "")
    .replace(/^covering\s+/i, "")
    .replace(/^areas?\s+covered[:\s]*/i, "")
    .replace(/\.$/, "")
    .trim();

  if (normalized.includes(",") || /^[A-Z]/.test(normalized)) {
    return `I'll check callers are in your area — ${normalized}.`;
  }

  return `I'll check callers are in your patch — ${lowercaseLead(normalizeYouVoice(text))}.`;
}

function buildReviewCaptureLine(details: string): string {
  const items = parseReviewChipList(details);
  if (items.length === 0) {
    return details.trim()
      ? polishSpeechText(
          `${lowercaseLead(normalizeYouVoice(stripTrailingPunctuation(details)))}.`,
        )
      : "";
  }

  const actions = items.map((item) =>
    lowercaseLead(normalizeCaptureItem(stripTrailingPunctuation(item))),
  );
  return polishSpeechText(`I'll ${joinNaturalLanguageList(actions)}.`);
}

function buildReviewRulesLine(rules: string[]): string {
  const cleaned = rules
    .map((rule) => stripTrailingPunctuation(rule))
    .filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) {
    return polishSpeechText(
      `I'll always make sure to ${lowercaseLead(cleaned[0]!)}.`,
    );
  }
  return polishSpeechText(
    `I'll always ${joinNaturalLanguageList(cleaned.map(lowercaseLead))}.`,
  );
}

function narrateHoursLine(line: string): string {
  const lower = line.toLowerCase();

  if (/emergency|callout|outside hours|after hours|24\s*\/\s*7|urgent/i.test(lower)) {
    const detail = line
      .replace(/^we\s+/i, "")
      .replace(/^also\s+/i, "")
      .replace(/\.$/, "")
      .trim();
    return `I'll also mention ${lowercaseLead(detail)}.`;
  }

  if (/^closed\b/i.test(line) || /\bclosed on\b/i.test(lower)) {
    const detail = line
      .replace(/^we'?re\s+/i, "you're ")
      .replace(/\.$/, "")
      .trim();
    return `I'll let callers know ${lowercaseLead(detail)}.`;
  }

  if (
    /\bopen\b/i.test(lower) ||
    /\bmonday\b/i.test(lower) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(lower)
  ) {
    const detail = line
      .replace(/^we'?re\s+open\b/i, "you're open")
      .replace(/^open\b/i, "you're open")
      .replace(/\.$/, "")
      .trim();
    return `I'll tell callers ${lowercaseLead(detail)}.`;
  }

  return `I'll explain that ${lowercaseLead(normalizeYouVoice(line.replace(/\.$/, "")))}.`;
}

function normalizeYouVoice(text: string): string {
  return text
    .replace(/^we\b/i, "you")
    .replace(/^our\b/i, "your")
    .replace(/^we're\b/i, "you're");
}

function normalizeCaptureItem(item: string): string {
  return item
    .replace(/^get the\b/i, "get their")
    .replace(/^get\b/i, "get")
    .replace(/^find out\b/i, "find out")
    .replace(/^ask\b/i, "ask")
    .replace(/^take\b/i, "take")
    .trim();
}

function lowercaseLead(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
