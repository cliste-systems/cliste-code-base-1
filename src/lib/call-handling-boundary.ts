/**
 * Niche-agnostic validation and lint helpers for Cara Setup call handling
 * (details to collect + business rules).
 */

import type { BusinessFileListItem } from "@/lib/business-files";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import { servicePriceIsSet } from "@/lib/service-catalog-format";
import {
  deriveCaraCapabilities,
  type CaraCapabilities,
} from "@/lib/cara-capabilities";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { dedupeCaraSetupChips, normalizeCaraSetupChip, caraSetupChipKey } from "@/lib/cara-setup-chips";
import { tryParseTemporaryUnavailabilityRule } from "@/lib/cara-instruction-heuristics";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { looksLikeExclusion } from "@/lib/services-boundary";

export const DETAILS_SURVEY_WARNING_THRESHOLD = 7;

/** Locked default — shared by Call handling UI and owner preview. */
export const CARA_WHEN_UNSURE_LOCKED_COPY =
  "If a caller asks for something not covered here, Cara never guesses. She takes the caller's name, number and request, and adds it to your Action Inbox.";

export const COLLECTION_RELEVANCE_INSTRUCTION =
  "I always get their name. For their number, I confirm the caller ID when it's showing before asking them to spell it out. I only ask for anything else when it fits what they called about — a quick question doesn't turn into a long checklist. I work questions into the chat naturally; I never read a list like a form. If they don't want to share something, I keep helping, note what's missing, and move on.";

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
      : "This sounds like a booking policy — add it as an FAQ or a note on the relevant service. Cara will take a message until booking is set up in Call flow.",
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

export const NEVER_QUOTE_PRICE_PATTERN =
  /\b(?:never|don'?t|do not)\b[^.]{0,40}\b(?:quote|give|discuss|mention)\b[^.]{0,30}\bpric/i;

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

const BUSINESS_POLICY_KEYWORDS =
  /\b(prices?|quotes?|deposits?|discounts?|refunds?|cancels?|cancellation|bookings?|hours?|walk-?ins?|payments?|opening)\b/i;

/** Standing policies (pricing, booking limits, deposits) — belong in Your policies. */
const BUSINESS_POLICY_PATTERNS: RegExp[] = [
  /\b(?:don'?t|do not|never|no)\s+(?:book|accept|take on)\b/i,
  /\bnot\s+(?:taking|accepting)\s+(?:bookings?|appointments?|new clients?)/i,
  /\b(?:book|booking|appointment)s?\s+(?:only|required)\b/i,
  /\b(?:new clients?|walk-?ins?)\b/i,
  /\b(?:deposit|cancellation fee|refund|no[- ]show)\b/i,
  /\b(?:minimum|at least)\s+\d+\s*(?:hours?|days?)\s+(?:notice|cancellation)/i,
  /\b(?:cash only|card only)\b/i,
  /\b(?:must|need to)\s+(?:pay|prepay|pay in advance)\b/i,
  /\b(?:consultation|patch test)\s+(?:required|before)\b/i,
  /\bdo not\s+(?:book|schedule|offer)\b/i,
  /\b(?:closed|not open)\s+(?:on|for)\b/i,
  /\b(?:only|just)\s+(?:for|serve)\s+(?:existing|returning)\s+clients?\b/i,
  /\b(?:flag|mark)\s+(?:anything|calls?)\s+urgent\b/i,
  /\balways\s+take\s+a\s+message\b/i,
];

/** Tone and phrasing — belong in Cara's style. */
const CARA_CONDUCT_PATTERNS: RegExp[] = [
  /\bkeep\s+(?:it\s+)?(?:answers?|replies?|responses?)\s+short\b/i,
  /\b(?:short|brief|concise)\s+(?:answers?|replies?|responses?)\b/i,
  /\b(?:use|say)\s+their\s+(?:first\s+)?name\b/i,
  /\b(?:first\s+)?name\s+when\s+you\s+have\s+it\b/i,
  /\b(?:friendly|warm|professional|polite)(?:\s+and\s+(?:friendly|warm|professional|polite))?\b/i,
  /\b(?:tone|phrasing|wording)\b/i,
  /\b(?:text|sms)\s+(?:them\s+)?(?:the\s+)?links?\b/i,
  /\boffer\s+to\s+text\b/i,
  /\b(?:don'?t|do not|never)\s+read\s+(?:out\s+)?(?:links?|urls?)\b/i,
  /\binstead\s+of\s+reading\s+(?:them\s+)?(?:out|aloud|urls?)\b/i,
  /\b(?:speak|talk)\s+(?:more\s+)?(?:slowly|clearly)\b/i,
  /\b(?:plain|simple)\s+(?:english|language)\b/i,
  /\bavoid\s+jargon\b/i,
  /\bconfirm\s+spelling\b/i,
];

export function looksLikeBusinessPolicyRule(text: string): boolean {
  const normalized = normalizeCaraSetupChip(text);
  if (!normalized) return false;
  if (tryParseTemporaryUnavailabilityRule(normalized)) return true;
  if (NEVER_QUOTE_PRICE_PATTERN.test(normalized)) return true;
  if (BUSINESS_POLICY_KEYWORDS.test(normalized)) return true;
  return BUSINESS_POLICY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function looksLikeCaraConductRule(text: string): boolean {
  const normalized = normalizeCaraSetupChip(text);
  if (!normalized) return false;
  return CARA_CONDUCT_PATTERNS.some((pattern) => pattern.test(normalized));
}

// --- Input validation ---

export type CallHandlingInputKind = "detail" | "rule" | "cara_rule";

export type WrongRuleSectionInterrupt =
  | "business-rules-home"
  | "cara-rules-home";

export function wrongRuleSectionInterrupt(
  kind: CallHandlingInputKind,
  text: string,
): WrongRuleSectionInterrupt | null {
  if (kind === "cara_rule" && looksLikeBusinessPolicyRule(text)) {
    return "business-rules-home";
  }
  if (
    kind === "rule" &&
    looksLikeCaraConductRule(text) &&
    !looksLikeBusinessPolicyRule(text)
  ) {
    return "cara-rules-home";
  }
  return null;
}

export const WRONG_RULE_SECTION_COPY: Record<
  WrongRuleSectionInterrupt,
  { title: string; description: string }
> = {
  "business-rules-home": {
    title: "Sounds like a business policy",
    description:
      "Your policies are standing rules Cara must follow — like pricing, booking limits, and what you do or don't offer.",
  },
  "cara-rules-home": {
    title: "Sounds like Cara's style",
    description:
      "Cara's style is for tone and phrasing on calls — like keeping answers short or texting links instead of reading them out.",
  },
};

export type MisfileNudge = {
  message: string;
  moveActionLabel: string;
  target: "policies" | "style";
};

export function misfileNudgeForRule(
  kind: CallHandlingInputKind,
  text: string,
): MisfileNudge | null {
  const interrupt = wrongRuleSectionInterrupt(kind, text);
  if (!interrupt) return null;

  if (interrupt === "business-rules-home") {
    return {
      message: "This looks like a business policy — move it to Your policies?",
      moveActionLabel: "Move",
      target: "policies",
    };
  }

  return {
    message: "This looks like Cara's style — move it to Cara's style?",
    moveActionLabel: "Move",
    target: "style",
  };
}

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
    if ((kind === "rule" || kind === "cara_rule") && pattern.test(text)) {
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
  action?: "add_faq";
  sourceText?: string;
  capabilityKind?: CapabilityKind;
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
        });
      }
    }
  }

  return warnings;
}

export function lintCatalogPricingVsRules(
  businessRules: string[],
  serviceCatalog: ServiceCatalogItem[],
): CallHandlingConflictWarning[] {
  const neverQuoteRules = dedupeCaraSetupChips(businessRules).filter((r) =>
    NEVER_QUOTE_PRICE_PATTERN.test(r),
  );
  const catalogHasPrices = serviceCatalog.some((s) => servicePriceIsSet(s.price));

  if (catalogHasPrices && neverQuoteRules.length > 0) {
    return [
      {
        id: "catalog-prices-never-quote-rule",
        message:
          "Your service menu has prices, but you have a rule telling Cara never to quote prices — she may contradict herself.",
        href: DASHBOARD_ROUTES.businessServices,
      },
    ];
  }

  return [];
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
        href: DASHBOARD_ROUTES.businessFaqs,
        secondaryHref: DASHBOARD_ROUTES.businessServices,
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
        href: DASHBOARD_ROUTES.businessFiles,
        secondaryHref: DASHBOARD_ROUTES.businessProfile,
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
    for (const { kind, patterns } of CAPABILITY_PATTERNS) {
      if (kind === "payment") continue;
      if (!patterns.some((p) => p.test(item))) continue;

      const configured = capabilityConfigured(kind, caps);
      const message = CAPABILITY_WARN_MESSAGES[kind](configured);
      if (!message || seen.has(message)) continue;
      seen.add(message);

      if (kind === "book" && !configured) {
        warnings.push({
          id: `capability-book-${caraSetupChipKey(item)}`,
          message: `"${item}" — ${message}`,
          href: DASHBOARD_ROUTES.businessFaqs,
          action: "add_faq",
          sourceText: item,
          capabilityKind: kind,
        });
        continue;
      }

      warnings.push({
        id: `capability-${kind}-${caraSetupChipKey(item)}`,
        message: `"${item}" — ${message}`,
        href: "/dashboard/routing",
        sourceText: item,
        capabilityKind: kind,
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
  serviceCatalog?: ServiceCatalogItem[];
  /** Dashboard has no business-rules editor — skip orphan rule capability nags. */
  lintBusinessRuleCapabilities?: boolean;
}): CallHandlingConflictWarning[] {
  const caps = deriveCaraCapabilities(input.routes, input.transferNumber);
  const lintBusinessRuleCapabilities = input.lintBusinessRuleCapabilities !== false;

  return [
    ...lintRuleVsRuleConflicts(input.businessRules),
    ...lintRuleVsPricingConflicts(
      input.businessRules,
      input.faqs,
      input.businessFiles,
    ),
    ...lintCatalogPricingVsRules(
      input.businessRules,
      input.serviceCatalog ?? [],
    ),
    ...(lintBusinessRuleCapabilities
      ? lintCapabilityWarningsForItems(input.businessRules, caps)
      : []),
    ...lintCapabilityWarningsForItems(input.detailsToCollect, caps),
  ];
}

export function buildCaraCapabilitiesFromPromptExtras(
  routes?: RoutingActionSummary[],
  transferNumber?: string,
): CaraCapabilities {
  return deriveCaraCapabilities(routes, transferNumber);
}
