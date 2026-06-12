/**
 * Niche-agnostic validation and lint helpers for Cara Setup call handling
 * (details to collect + business rules).
 */

import type { BusinessFileListItem } from "@/lib/business-files";
import {
  deriveCaraCapabilities,
  type CaraCapabilities,
} from "@/lib/cara-capabilities";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { dedupeCaraSetupChips, normalizeCaraSetupChip } from "@/lib/cara-setup-chips";
import { looksLikeExclusion } from "@/lib/services-boundary";

export const DETAILS_SURVEY_WARNING_THRESHOLD = 7;

/** Locked default — shared by Call handling UI and owner preview. */
export const CARA_WHEN_UNSURE_LOCKED_COPY =
  "If a caller asks for something not covered here, Cara never guesses. She takes the caller's name, number and request, and adds it to your Action Inbox.";

export const COLLECTION_RELEVANCE_INSTRUCTION =
  "I always get their name and number. I only ask for anything else when it fits what they called about — a quick question doesn't turn into a long checklist. I work questions into the chat naturally; I never read a list like a form. If they don't want to share something, I keep helping, note what's missing, and move on.";

export const PHOTO_HANDLING_INSTRUCTION =
  "If they mention photos, pictures, or video, I say that's fine, note they have them, and move on — I can't take images on a call.";

export const NEVER_PROMISE_INSTRUCTION =
  "I only promise what's listed above — anything else, I offer to take a message.";

/** Kept for precedence semantics in the compiled prompt. */
export const PRECEDENCE_CONFLICT_INSTRUCTION =
  "If one of your rules clashes with any of the above, I follow the higher one.";

// --- Hard block: compliance override (business rules only) ---

const COMPLIANCE_OVERRIDE_PATTERNS: { pattern: RegExp; message: string }[] = [
  {
    pattern:
      /\b(?:don'?t|do not|never|skip|avoid|without)\b[^.]{0,40}\b(?:say|mention|tell|admit)\b[^.]{0,40}\b(?:ai|robot|assistant|artificial)/i,
    message:
      "This conflicts with the legal disclosure Cara must give — she can't follow it.",
  },
  {
    pattern:
      /\b(?:don'?t|do not|never|skip|avoid)\b[^.]{0,40}\b(?:mention|say|give)\b[^.]{0,30}\brecord/i,
    message:
      "This conflicts with the legal disclosure Cara must give — she can't follow it.",
  },
  {
    pattern: /\bskip\b[^.]{0,30}\bdisclosure\b/i,
    message:
      "This conflicts with the legal disclosure Cara must give — she can't follow it.",
  },
  {
    pattern:
      /\b(?:say yes|just agree|always agree|guess|make up|invent)\b[^.]{0,40}\b(?:if|when)\b[^.]{0,20}\b(?:unsure|don'?t know|uncertain)/i,
    message:
      "Cara never guesses when she's unsure — she takes a message instead.",
  },
  {
    pattern:
      /\b(?:guess|just say yes|agree anyway)\b[^.]{0,30}\b(?:if|when)\b[^.]{0,20}\b(?:unsure|don'?t know)/i,
    message:
      "Cara never guesses when she's unsure — she takes a message instead.",
  },
];

// --- Hard block: payment / security (rules + details) ---

const PAYMENT_SECURITY_BLOCK_PATTERNS: RegExp[] = [
  /\bcard\s+details?\b/i,
  /\bcredit\s+card\b/i,
  /\bdebit\s+card\b/i,
  /\bcard\s+number\b/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /\bsecurity\s+code\b/i,
  /\bpin\b/i,
  /\bpassword\b/i,
  /\bpayment\s+(?:over|on|via)\s+(?:the\s+)?phone\b/i,
  /\btake\s+(?:their\s+)?card\b/i,
  /\bcollect\s+(?:their\s+)?card\b/i,
];

export const PAYMENT_SECURITY_BLOCK_MESSAGE =
  "Cara never collects payment or security details on a recorded call.";

// --- Hard block: sensitive / special-category data (rules + details) ---

const SENSITIVE_DATA_BLOCK_PATTERNS: RegExp[] = [
  /\bpps\b/i,
  /\bpassport\b/i,
  /\blicen[cs]e\s+number\b/i,
  /\bdriving\s+licen[cs]e\b/i,
  /\biban\b/i,
  /\bbank\s+details?\b/i,
  /\baccount\s+number\b/i,
  /\bdate\s+of\s+birth\b/i,
  /\bdob\b/i,
  /\bmedical\s+history\b/i,
  /\bhealth\s+information\b/i,
  /\bmedical\s+condition\b/i,
  /\bmedication\b/i,
  /\bpregnan(?:t|cy)\b/i,
  /\ballerg(?:y|ies)\b/i,
  /\bsymptom/i,
  /\bdiagnos/i,
  /\bdisabilit/i,
  /\bmental\s+health\b/i,
  /\breligion\b/i,
  /\bethnic/i,
  /\bsexual\s+orientation\b/i,
  /\b(?:ask|collect|get|take)\b[^.]{0,40}\b(?:medical|health|pregnancy|allerg)/i,
];

export const SENSITIVE_DATA_BLOCK_MESSAGE =
  "Cara must not ask for medical history, pregnancy, allergies, PPS, bank details, or other sensitive personal data on a transcribed call.";

/** Used by FAQ lint and other save-time checks. */
export function matchesSensitiveDataCollection(text: string): boolean {
  return SENSITIVE_DATA_BLOCK_PATTERNS.some((p) => p.test(text));
}

export const SPECIAL_CATEGORY_MINIMISATION_INSTRUCTION =
  "I never ask for health information, pregnancy, allergies, medical history, religion, or other sensitive personal details — even if a business rule seems to ask for it.";

export const VOLUNTEERED_SENSITIVE_INSTRUCTION =
  "If a caller volunteers sensitive personal details, I acknowledge briefly without repeating them, I do not include them in summaries, and I steer back to why they called or taking a message.";

export const DETAILS_SURVEY_WARNING_MESSAGE =
  "Long lists make calls feel like a survey — Cara works best with the essentials.";

// --- Capability lint: action verbs ---

type CapabilityKind =
  | "book"
  | "transfer"
  | "sendLink"
  | "email"
  | "whatsapp"
  | "payment"
  | "photo";

const CAPABILITY_PATTERNS: { kind: CapabilityKind; patterns: RegExp[] }[] = [
  {
    kind: "book",
    patterns: [
      /\bbook\b/i,
      /\bschedule\b/i,
      /\breserve\b/i,
      /\bappointment\b/i,
      /\bcalendar\b/i,
    ],
  },
  {
    kind: "transfer",
    patterns: [
      /\btransfer\b/i,
      /\bput\s+(?:me\s+)?through\b/i,
      /\bpatch\b/i,
      /\bconnect\s+me\b/i,
    ],
  },
  {
    kind: "sendLink",
    patterns: [
      /\btext\b[^.]{0,30}\blink\b/i,
      /\bsend\b[^.]{0,30}\blink\b/i,
      /\bsms\b/i,
    ],
  },
  {
    kind: "email",
    patterns: [/\bemail\b/i, /\be-mail\b/i],
  },
  {
    kind: "whatsapp",
    patterns: [/\bwhatsapp\b/i],
  },
  {
    kind: "payment",
    patterns: [
      /\btake\s+payment\b/i,
      /\bcollect\s+payment\b/i,
      /\bpayment\s+over\b/i,
    ],
  },
  {
    kind: "photo",
    patterns: [
      /\bphoto(?:s|graph)?\b/i,
      /\bpicture\b/i,
      /\bvideo\b/i,
      /\bimage\b/i,
    ],
  },
];

const CAPABILITY_WARN_MESSAGES: Record<
  Exclude<CapabilityKind, "payment">,
  (configured: boolean) => string
> = {
  book: (configured) =>
    configured
      ? ""
      : "Cara can't book appointments yet — set it up in Call flow, or she'll take a message instead.",
  transfer: (configured) =>
    configured
      ? ""
      : "Cara can't transfer calls yet — set it up in Call flow, or she'll take a message instead.",
  sendLink: (configured) =>
    configured
      ? ""
      : "Cara can't text links yet — set it up in Call flow, or she'll take a message instead.",
  email: (configured) =>
    configured
      ? ""
      : "Cara can't email yet — set it up in Call flow, or she'll take a message instead.",
  whatsapp: (configured) =>
    configured
      ? ""
      : "Cara can't use WhatsApp yet — set it up in Call flow, or she'll take a message instead.",
  photo: () =>
    "Cara can't take photos on a call — she'll note that the caller has them.",
};

function capabilityConfigured(
  kind: CapabilityKind,
  caps: CaraCapabilities,
): boolean {
  switch (kind) {
    case "book":
      return caps.book;
    case "transfer":
      return caps.transfer;
    case "sendLink":
      return caps.sendLink;
    case "email":
      return caps.email;
    case "whatsapp":
      return caps.whatsapp;
    case "payment":
      return false;
    case "photo":
      return false;
    default:
      return false;
  }
}

export function detectCapabilityWarnings(
  text: string,
  caps: CaraCapabilities,
): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const { kind, patterns } of CAPABILITY_PATTERNS) {
    if (kind === "payment") continue;
    if (!patterns.some((p) => p.test(text))) continue;

    const configured = capabilityConfigured(kind, caps);
    const message = CAPABILITY_WARN_MESSAGES[kind](configured);
    if (message && !seen.has(message)) {
      seen.add(message);
      warnings.push(message);
    }
  }

  return warnings;
}

// --- Wrong-home detection (business rules) ---

const WEEKDAYS =
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;

const HOURS_PATTERNS: RegExp[] = [
  /\bclosed\b/i,
  /\bopen\s+until\b/i,
  /\bshut\b/i,
  /\bholiday\b/i,
  /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
];

export function looksLikeOpeningHours(text: string): boolean {
  const normalized = normalizeCaraSetupChip(text);
  if (!normalized) return false;
  const hasWeekday = WEEKDAYS.test(normalized);
  const hasHoursCue = HOURS_PATTERNS.some((p) => p.test(normalized));
  return hasWeekday && hasHoursCue;
}

export function looksLikeServiceExclusion(text: string): boolean {
  return looksLikeExclusion(text);
}

// --- Input validation ---

export type CallHandlingInputKind = "detail" | "rule";

export type CallHandlingAddValidation =
  | { ok: true; warnings?: string[] }
  | { ok: false; block: string };

export function validateCallHandlingAdd(
  raw: string,
  kind: CallHandlingInputKind,
  caps: CaraCapabilities,
): CallHandlingAddValidation {
  const text = normalizeCaraSetupChip(raw);
  if (!text) return { ok: false, block: "Enter something to add." };

  for (const { pattern, message } of COMPLIANCE_OVERRIDE_PATTERNS) {
    if (kind === "rule" && pattern.test(text)) {
      return { ok: false, block: message };
    }
  }

  if (PAYMENT_SECURITY_BLOCK_PATTERNS.some((p) => p.test(text))) {
    return { ok: false, block: PAYMENT_SECURITY_BLOCK_MESSAGE };
  }

  if (matchesSensitiveDataCollection(text)) {
    return { ok: false, block: SENSITIVE_DATA_BLOCK_MESSAGE };
  }

  const warnings: string[] = [];

  warnings.push(...detectCapabilityWarnings(text, caps));

  return { ok: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// --- Save-time conflict lint ---

const ALWAYS_PATTERN = /\balways\b/i;
const NEVER_PATTERN = /\b(?:never|don'?t|do not)\b/i;

const PRICE_CURRENCY_PATTERN = /(?:€|£|\$)\s*\d+|\d+\s*(?:€|£|\$|euro|eur)\b/i;

const NEVER_QUOTE_PRICE_PATTERN =
  /\b(?:never|don'?t|do not)\b[^.]{0,40}\b(?:quote|give|discuss|mention)\b[^.]{0,30}\bpric/i;

function significantRuleWords(text: string): string[] {
  const stop = new Set([
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
    "only",
    "that",
    "the",
    "this",
    "with",
    "your",
    "always",
    "never",
  ]);
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.has(w));
}

function rulesConflict(ruleA: string, ruleB: string): boolean {
  const aAlways = ALWAYS_PATTERN.test(ruleA);
  const aNever = NEVER_PATTERN.test(ruleA);
  const bAlways = ALWAYS_PATTERN.test(ruleB);
  const bNever = NEVER_PATTERN.test(ruleB);

  if (!((aAlways && bNever) || (aNever && bAlways))) return false;

  const wordsA = significantRuleWords(ruleA);
  const wordsB = significantRuleWords(ruleB);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const shared = wordsA.filter((w) => wordsB.includes(w));
  return shared.length >= 1;
}

export type CallHandlingConflictWarning = {
  id: string;
  message: string;
  href?: string;
  secondaryHref?: string;
};

export function lintRuleVsRuleConflicts(rules: string[]): CallHandlingConflictWarning[] {
  const deduped = dedupeCaraSetupChips(rules);
  const warnings: CallHandlingConflictWarning[] = [];

  for (let i = 0; i < deduped.length; i++) {
    for (let j = i + 1; j < deduped.length; j++) {
      const a = deduped[i]!;
      const b = deduped[j]!;
      if (rulesConflict(a, b)) {
        warnings.push({
          id: `rule-rule-${i}-${j}`,
          message: `Possible conflict: "${a}" and "${b}" may contradict each other — Cara may not know which to follow.`,
          href: "/dashboard/cara-setup/call-handling",
        });
      }
    }
  }

  return warnings;
}

export function lintRuleVsPricingConflicts(
  rules: string[],
  faqs: { question: string; answer: string }[],
  businessFiles: BusinessFileListItem[],
): CallHandlingConflictWarning[] {
  const neverQuoteRules = dedupeCaraSetupChips(rules).filter((r) =>
    NEVER_QUOTE_PRICE_PATTERN.test(r),
  );
  if (neverQuoteRules.length === 0) return [];

  const warnings: CallHandlingConflictWarning[] = [];

  for (const rule of neverQuoteRules) {
    for (const faq of faqs) {
      const answer = faq.answer.trim();
      if (!answer || !PRICE_CURRENCY_PATTERN.test(answer)) continue;
      warnings.push({
        id: `rule-faq-price-${rule}-${faq.question}`,
        message: `You've told Cara never to quote prices, but the answer to "${faq.question.trim() || "Common question"}" contains prices — she may contradict herself.`,
        href: "/dashboard/cara-setup/call-handling",
        secondaryHref: "/dashboard/cara-setup/answers",
      });
    }

    const priceFiles = businessFiles.filter(
      (f) =>
        f.documentKind === "price_list" &&
        f.answerEnabled &&
        (f.extractedText?.trim() || f.fileName),
    );
    for (const file of priceFiles) {
      warnings.push({
        id: `rule-file-price-${rule}-${file.id}`,
        message: `You've told Cara never to quote prices, but "${file.fileName}" is a price list she can read aloud — she may contradict herself.`,
        href: "/dashboard/cara-setup/call-handling",
        secondaryHref: "/dashboard/cara-setup/general",
      });
    }
  }

  return warnings;
}

export function lintCapabilityWarningsForItems(
  items: string[],
  caps: CaraCapabilities,
): CallHandlingConflictWarning[] {
  const warnings: CallHandlingConflictWarning[] = [];
  const seen = new Set<string>();

  for (const item of dedupeCaraSetupChips(items)) {
    for (const message of detectCapabilityWarnings(item, caps)) {
      if (seen.has(message)) continue;
      seen.add(message);
      warnings.push({
        id: `capability-${message}`,
        message: `"${item}" — ${message}`,
        href: "/dashboard/routing",
      });
    }
  }

  return warnings;
}

export function buildCallHandlingConflictWarnings(input: {
  businessRules: string[];
  detailsToCollect: string[];
  faqs: { question: string; answer: string }[];
  businessFiles: BusinessFileListItem[];
  routes?: RoutingActionSummary[];
  transferNumber?: string;
}): CallHandlingConflictWarning[] {
  const caps = deriveCaraCapabilities(input.routes, input.transferNumber);

  return [
    ...lintRuleVsRuleConflicts(input.businessRules),
    ...lintRuleVsPricingConflicts(
      input.businessRules,
      input.faqs,
      input.businessFiles,
    ),
    ...lintCapabilityWarningsForItems(input.businessRules, caps),
    ...lintCapabilityWarningsForItems(input.detailsToCollect, caps),
  ];
}

export function buildCaraCapabilitiesFromPromptExtras(
  routes?: RoutingActionSummary[],
  transferNumber?: string,
): CaraCapabilities {
  return deriveCaraCapabilities(routes, transferNumber);
}
