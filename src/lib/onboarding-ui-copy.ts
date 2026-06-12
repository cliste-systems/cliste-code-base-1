import "server-only";

import {
  BUSINESS_RULE_SUGGESTION_COUNT,
  DEFAULT_BUSINESS_RULE_SUGGESTIONS,
  DEFAULT_FAQ_SUGGESTIONS,
  FAQ_EXAMPLE_SUGGESTION_COUNT,
  SALON_FAQ_SUGGESTIONS,
  TRADES_FAQ_SUGGESTIONS,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-constants";
import {
  packServicesStepCopy,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-services-copy";
import {
  detectTradePack,
  type TradePack,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-trade-topics";
import {
  buildOnboardingUiCopyContextKey,
  type HandleOptionDescriptions,
  type OnboardingUiCopy,
} from "@/lib/onboarding-ui-copy-shared";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

export type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";
export { buildOnboardingUiCopyContextKey } from "@/lib/onboarding-ui-copy-shared";

export type GenerateOnboardingUiCopyInput = {
  businessName: string;
  businessType?: string | null;
  niche?: string | null;
  rawBusinessDescription: string;
  openingHours?: string;
  serviceArea?: string;
  servicesOffered?: string;
};

const MAX_SERVICES_FIELD = 220;

const MAX_SUGGESTIONS = FAQ_EXAMPLE_SUGGESTION_COUNT;
const MAX_RULE_SUGGESTIONS = BUSINESS_RULE_SUGGESTION_COUNT;
const MAX_QUESTION = 120;
const MAX_RULE = 160;
const MAX_HINT = 220;
const MAX_PLACEHOLDER = 120;
const MAX_HANDLE_DESCRIPTION = 100;

const HANDLE_OPTION_IDS = [
  "send_link",
  "send_file",
  "email_request",
  "send_whatsapp",
  "capture_quote_requests",
  "book_meeting",
] as const;

function trimField(value: string | undefined, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function packFaqStepHint(pack: TradePack): string {
  if (pack === "salon") {
    return "Appointments, pricing, and walk-ins — Cara already knows your hours and location from the last step.";
  }
  if (pack === "trades") {
    return "Call-outs, quotes, and emergencies — Cara already knows your hours and areas from the last step.";
  }
  return "Pricing, booking, and what to expect — Cara already knows your basics from the last step.";
}

function packQuestionPlaceholder(pack: TradePack): string {
  if (pack === "salon") return "e.g. Do you take walk-ins?";
  if (pack === "trades") return "e.g. Do you do emergency call-outs?";
  return "e.g. How much does it cost?";
}

function packAnswerPlaceholder(pack: TradePack): string {
  if (pack === "salon") {
    return "e.g. Walk-ins are welcome before 4pm — colour needs booking.";
  }
  if (pack === "trades") {
    return "e.g. Yes, 24/7 for burst pipes; standard jobs Mon–Sat.";
  }
  return "e.g. We offer a free 15-minute consultation before quoting.";
}

function packFaqSuggestions(pack: TradePack): readonly string[] {
  if (pack === "salon") return SALON_FAQ_SUGGESTIONS;
  if (pack === "trades") return TRADES_FAQ_SUGGESTIONS;
  return DEFAULT_FAQ_SUGGESTIONS;
}

function packBusinessRuleSuggestions(_pack: TradePack): readonly string[] {
  return DEFAULT_BUSINESS_RULE_SUGGESTIONS;
}

function packBusinessRulesStepHint(pack: TradePack): string {
  if (pack === "salon") {
    return "Walk-in limits, cancellation windows, and what you won't do — Cara must never promise the opposite.";
  }
  if (pack === "trades") {
    return "Days off, emergency limits, minimum charges, and jobs you won't take — Cara stays on script.";
  }
  return "Policies Cara must follow on every call — no exceptions.";
}

function packRulePlaceholder(pack: TradePack): string {
  if (pack === "salon") return "e.g. Colour appointments need 48 hours notice.";
  if (pack === "trades") return "e.g. Minimum callout charge is €80.";
  return "e.g. We need 24 hours notice for cancellations.";
}

function packHandleStepHint(pack: TradePack): string {
  if (pack === "salon") {
    return "Salon callers often want booking links or your price menu sent — pick anything else Cara should handle. She already answers FAQs and takes messages.";
  }
  if (pack === "trades") {
    return "Trade callers often need quotes captured or a quick follow-up on WhatsApp — pick what fits your business. Cara already answers FAQs and takes messages.";
  }
  return "Pick anything else callers might need. Cara already answers FAQs and takes messages.";
}

function packHandleOptionDescriptions(pack: TradePack) {
  if (pack === "salon") {
    return {
      send_link: "Share your online booking or Instagram link.",
      send_file: "Send your price list or service menu.",
      email_request: "Email appointment requests to your team.",
      send_whatsapp: "Follow up about colour consults or bookings.",
      capture_quote_requests: "Collect service, timing, and contact details.",
      book_meeting: "Send a link to book a cut, colour, or treatment.",
    };
  }
  if (pack === "trades") {
    return {
      send_link: "Share your quote form or website.",
      send_file: "Send a brochure, price guide, or safety sheet.",
      email_request: "Email job details and caller info to your team.",
      send_whatsapp: "Follow up with photos or a quick quote update.",
      capture_quote_requests: "Collect job type, location, and urgency.",
      book_meeting: "Send a link to book a survey or callback slot.",
    };
  }
  return {
    send_link: "Share a booking page, form, or website link.",
    send_file: "Send a brochure, menu, price list, or document.",
    email_request: "Email caller details and the request to your team.",
    send_whatsapp: "Follow up with the caller on WhatsApp.",
    capture_quote_requests: "Collect quote details, location, and urgency.",
    book_meeting: "Send a link to book a meeting or call.",
  };
}

function cleanHandleOptionDescriptions(value: unknown): HandleOptionDescriptions {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const out: HandleOptionDescriptions = {};
  for (const id of HANDLE_OPTION_IDS) {
    const raw = record[id];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, MAX_HANDLE_DESCRIPTION);
    if (trimmed) out[id] = trimmed;
  }
  return out;
}

function mergeHandleOptionDescriptions(
  pack: TradePack,
  overrides?: HandleOptionDescriptions,
): HandleOptionDescriptions {
  return { ...packHandleOptionDescriptions(pack), ...overrides };
}

function servicesFieldsFromPack(
  input: GenerateOnboardingUiCopyInput,
): Pick<
  OnboardingUiCopy,
  | "servicesStepSubtitle"
  | "servicesOfferedLabel"
  | "servicesOfferedPlaceholder"
  | "servicesNotOfferedLabel"
  | "servicesNotOfferedPlaceholder"
  | "servicesStepHelper"
> {
  const copy = packServicesStepCopy(
    String(input.businessType ?? "").trim(),
    String(input.niche ?? "").trim(),
  );
  return {
    servicesStepSubtitle: copy.subtitle,
    servicesOfferedLabel: copy.primaryLabel,
    servicesOfferedPlaceholder: copy.primaryPlaceholder,
    servicesNotOfferedLabel: copy.secondaryLabel,
    servicesNotOfferedPlaceholder: copy.secondaryPlaceholder,
    servicesStepHelper: copy.helper,
  };
}

function mergeServicesFields(
  input: GenerateOnboardingUiCopyInput,
  overrides: Partial<OnboardingUiCopy>,
): Pick<
  OnboardingUiCopy,
  | "servicesStepSubtitle"
  | "servicesOfferedLabel"
  | "servicesOfferedPlaceholder"
  | "servicesNotOfferedLabel"
  | "servicesNotOfferedPlaceholder"
  | "servicesStepHelper"
> {
  const base = servicesFieldsFromPack(input);
  return {
    servicesStepSubtitle:
      trimField(overrides.servicesStepSubtitle, MAX_SERVICES_FIELD) ||
      base.servicesStepSubtitle,
    servicesOfferedLabel:
      trimField(overrides.servicesOfferedLabel, MAX_SERVICES_FIELD) ||
      base.servicesOfferedLabel,
    servicesOfferedPlaceholder:
      trimField(overrides.servicesOfferedPlaceholder, MAX_SERVICES_FIELD) ||
      base.servicesOfferedPlaceholder,
    servicesNotOfferedLabel:
      trimField(overrides.servicesNotOfferedLabel, MAX_SERVICES_FIELD) ||
      base.servicesNotOfferedLabel,
    servicesNotOfferedPlaceholder:
      trimField(overrides.servicesNotOfferedPlaceholder, MAX_SERVICES_FIELD) ||
      base.servicesNotOfferedPlaceholder,
    servicesStepHelper:
      trimField(overrides.servicesStepHelper, MAX_HINT) || base.servicesStepHelper,
  };
}

export function buildHeuristicOnboardingUiCopy(
  input: GenerateOnboardingUiCopyInput,
): OnboardingUiCopy {
  const businessType = String(input.businessType ?? "").trim();
  const pack = detectTradePack(businessType);
  const contextKey = buildOnboardingUiCopyContextKey({
    businessType,
    rawBusinessDescription: input.rawBusinessDescription,
  });

  return {
    faqSuggestions: [...packFaqSuggestions(pack)],
    faqStepHint: packFaqStepHint(pack),
    questionPlaceholder: packQuestionPlaceholder(pack),
    answerPlaceholder: packAnswerPlaceholder(pack),
    businessRuleSuggestions: [...packBusinessRuleSuggestions(pack)],
    businessRulesStepHint: packBusinessRulesStepHint(pack),
    rulePlaceholder: packRulePlaceholder(pack),
    handleStepHint: packHandleStepHint(pack),
    handleOptionDescriptions: packHandleOptionDescriptions(pack),
    ...servicesFieldsFromPack(input),
    source: "heuristic",
    contextKey,
  };
}

function cleanRuleSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, MAX_RULE);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_RULE_SUGGESTIONS) break;
  }
  return out;
}

function cleanSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, MAX_QUESTION);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

function parseOnboardingUiCopyJson(
  raw: string,
  contextKey: string,
  input: GenerateOnboardingUiCopyInput,
): OnboardingUiCopy | null {
  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    const json = JSON.parse(trimmed.slice(start, end + 1)) as {
      faqSuggestions?: unknown;
      faqStepHint?: unknown;
      questionPlaceholder?: unknown;
      answerPlaceholder?: unknown;
      businessRuleSuggestions?: unknown;
      businessRulesStepHint?: unknown;
      rulePlaceholder?: unknown;
      handleStepHint?: unknown;
      handleOptionDescriptions?: unknown;
      servicesStepSubtitle?: unknown;
      servicesOfferedLabel?: unknown;
      servicesOfferedPlaceholder?: unknown;
      servicesNotOfferedLabel?: unknown;
      servicesNotOfferedPlaceholder?: unknown;
      servicesStepHelper?: unknown;
    };

    const faqSuggestions = cleanSuggestions(json.faqSuggestions);
    const faqStepHint = trimField(String(json.faqStepHint ?? ""), MAX_HINT);
    const questionPlaceholder = trimField(
      String(json.questionPlaceholder ?? ""),
      MAX_PLACEHOLDER,
    );
    const answerPlaceholder = trimField(
      String(json.answerPlaceholder ?? ""),
      MAX_PLACEHOLDER,
    );
    const businessRuleSuggestions = cleanRuleSuggestions(json.businessRuleSuggestions);
    const businessRulesStepHint = trimField(
      String(json.businessRulesStepHint ?? ""),
      MAX_HINT,
    );
    const rulePlaceholder = trimField(
      String(json.rulePlaceholder ?? ""),
      MAX_PLACEHOLDER,
    );
    const handleStepHint = trimField(String(json.handleStepHint ?? ""), MAX_HINT);
    const handleOptionDescriptions = cleanHandleOptionDescriptions(
      json.handleOptionDescriptions,
    );

    if (
      faqSuggestions.length < FAQ_EXAMPLE_SUGGESTION_COUNT ||
      !faqStepHint ||
      !questionPlaceholder
    ) {
      return null;
    }

    const pack = detectTradePack(contextKey.split("::")[0] ?? "");

    return {
      faqSuggestions,
      faqStepHint,
      questionPlaceholder,
      answerPlaceholder: answerPlaceholder || packAnswerPlaceholder("default"),
      businessRuleSuggestions:
        businessRuleSuggestions.length >= BUSINESS_RULE_SUGGESTION_COUNT
          ? businessRuleSuggestions
          : [...packBusinessRuleSuggestions(pack)],
      businessRulesStepHint:
        businessRulesStepHint || packBusinessRulesStepHint(pack),
      rulePlaceholder: rulePlaceholder || packRulePlaceholder(pack),
      handleStepHint: handleStepHint || packHandleStepHint(pack),
      handleOptionDescriptions: mergeHandleOptionDescriptions(
        pack,
        handleOptionDescriptions,
      ),
      ...mergeServicesFields(input, {
          servicesStepSubtitle: trimField(
            String(json.servicesStepSubtitle ?? ""),
            MAX_SERVICES_FIELD,
          ),
          servicesOfferedLabel: trimField(
            String(json.servicesOfferedLabel ?? ""),
            MAX_SERVICES_FIELD,
          ),
          servicesOfferedPlaceholder: trimField(
            String(json.servicesOfferedPlaceholder ?? ""),
            MAX_SERVICES_FIELD,
          ),
          servicesNotOfferedLabel: trimField(
            String(json.servicesNotOfferedLabel ?? ""),
            MAX_SERVICES_FIELD,
          ),
          servicesNotOfferedPlaceholder: trimField(
            String(json.servicesNotOfferedPlaceholder ?? ""),
            MAX_SERVICES_FIELD,
          ),
          servicesStepHelper: trimField(
            String(json.servicesStepHelper ?? ""),
            MAX_HINT,
          ),
        }),
      source: "openrouter",
      contextKey,
    };
  } catch {
    return null;
  }
}

export function parseStoredOnboardingUiCopy(value: unknown): OnboardingUiCopy | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const contextKey = trimField(String(record.contextKey ?? ""), 700);
  if (!contextKey) return null;

  const faqSuggestions = cleanSuggestions(record.faqSuggestions);
  const faqStepHint = trimField(String(record.faqStepHint ?? ""), MAX_HINT);
  const questionPlaceholder = trimField(
    String(record.questionPlaceholder ?? ""),
    MAX_PLACEHOLDER,
  );
  const answerPlaceholder = trimField(
    String(record.answerPlaceholder ?? ""),
    MAX_PLACEHOLDER,
  );
  const source = record.source === "openrouter" ? "openrouter" : "heuristic";

  if (
    faqSuggestions.length < FAQ_EXAMPLE_SUGGESTION_COUNT ||
    !faqStepHint ||
    !questionPlaceholder
  ) {
    return null;
  }

  const pack = detectTradePack(contextKey.split("::")[0] ?? "");
  const businessRuleSuggestions = cleanRuleSuggestions(record.businessRuleSuggestions);
  const businessRulesStepHint = trimField(
    String(record.businessRulesStepHint ?? ""),
    MAX_HINT,
  );
  const rulePlaceholder = trimField(String(record.rulePlaceholder ?? ""), MAX_PLACEHOLDER);
  const handleStepHint = trimField(String(record.handleStepHint ?? ""), MAX_HINT);
  const handleOptionDescriptions = cleanHandleOptionDescriptions(
    record.handleOptionDescriptions,
  );

  return {
    faqSuggestions,
    faqStepHint,
    questionPlaceholder,
    answerPlaceholder: answerPlaceholder || packAnswerPlaceholder("default"),
    businessRuleSuggestions:
      businessRuleSuggestions.length >= BUSINESS_RULE_SUGGESTION_COUNT
        ? businessRuleSuggestions
        : [...packBusinessRuleSuggestions(pack)],
    businessRulesStepHint:
      businessRulesStepHint || packBusinessRulesStepHint(pack),
    rulePlaceholder: rulePlaceholder || packRulePlaceholder(pack),
    handleStepHint: handleStepHint || packHandleStepHint(pack),
    handleOptionDescriptions: mergeHandleOptionDescriptions(
      pack,
      handleOptionDescriptions,
    ),
    ...mergeServicesFields(
      {
        businessName: "",
        businessType: contextKey.split("::")[0] ?? "",
        niche: "",
        rawBusinessDescription: contextKey.split("::")[1] ?? "",
      },
      {
        servicesStepSubtitle: trimField(
          String(record.servicesStepSubtitle ?? ""),
          MAX_SERVICES_FIELD,
        ),
        servicesOfferedLabel: trimField(
          String(record.servicesOfferedLabel ?? ""),
          MAX_SERVICES_FIELD,
        ),
        servicesOfferedPlaceholder: trimField(
          String(record.servicesOfferedPlaceholder ?? ""),
          MAX_SERVICES_FIELD,
        ),
        servicesNotOfferedLabel: trimField(
          String(record.servicesNotOfferedLabel ?? ""),
          MAX_SERVICES_FIELD,
        ),
        servicesNotOfferedPlaceholder: trimField(
          String(record.servicesNotOfferedPlaceholder ?? ""),
          MAX_SERVICES_FIELD,
        ),
        servicesStepHelper: trimField(
          String(record.servicesStepHelper ?? ""),
          MAX_HINT,
        ),
      },
    ),
    source,
    contextKey,
  };
}

export async function generateOnboardingUiCopy(
  input: GenerateOnboardingUiCopyInput,
): Promise<{ ok: true; copy: OnboardingUiCopy } | { ok: false; message: string }> {
  const rawBusinessDescription = String(input.rawBusinessDescription ?? "").trim();
  if (rawBusinessDescription.length < 20) {
    return {
      ok: false,
      message: "Add a bit more detail on the previous step first.",
    };
  }

  const businessName = String(input.businessName ?? "").trim() || "the business";
  const businessType = String(input.businessType ?? "").trim();
  const niche = String(input.niche ?? "").trim();
  const contextKey = buildOnboardingUiCopyContextKey({
    businessType,
    rawBusinessDescription,
  });

  const contextLines = [
    businessType ? `Business type: ${businessType}` : null,
    niche ? `Niche: ${niche}` : null,
    input.openingHours?.trim() ? `Opening hours: ${input.openingHours.trim()}` : null,
    input.serviceArea?.trim() ? `Areas / location: ${input.serviceArea.trim()}` : null,
    input.servicesOffered?.trim() ? `Services / offer: ${input.servicesOffered.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.35,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: `You suggest onboarding copy for Cara, an AI phone assistant for Irish/local businesses.
Return JSON only:
{"faqSuggestions":["..."],"faqStepHint":"...","questionPlaceholder":"...","answerPlaceholder":"...","businessRuleSuggestions":["..."],"businessRulesStepHint":"...","rulePlaceholder":"...","handleStepHint":"...","handleOptionDescriptions":{"send_link":"...","send_file":"...","email_request":"...","send_whatsapp":"...","capture_quote_requests":"...","book_meeting":"..."},"servicesStepSubtitle":"...","servicesOfferedLabel":"...","servicesOfferedPlaceholder":"...","servicesNotOfferedLabel":"...","servicesNotOfferedPlaceholder":"...","servicesStepHelper":"..."}
Rules:
- faqSuggestions: exactly 3 short questions real callers would ask THIS specific business (not generic templates)
- Do NOT suggest questions about opening hours, location, address, or service areas (already captured elsewhere)
- Match the trade precisely (cafe, plumber, salon, clinic, etc.) — use industry-appropriate wording
- faqStepHint: one sentence; lead with 3 topic areas relevant to this business, then " — Cara already knows your hours and areas from the last step."
- questionPlaceholder: one "e.g. …" example question tailored to this business
- answerPlaceholder: one "e.g. …" example answer Cara might give
- businessRuleSuggestions: exactly 5 short hard rules Cara must never break (days off, service limits, minimum charges, areas not served, etc.) — first-person plural ("We don't…", "Minimum charge is…")
- businessRulesStepHint: one sentence on why these limits matter for this trade
- rulePlaceholder: one "e.g. …" example rule tailored to this business
- handleStepHint: one sentence naming THIS business type or what they do; mention 2–3 caller actions that fit (links, quotes, WhatsApp, etc.), then " — Cara already answers FAQs and takes messages." Reference the business naturally (e.g. "For a plumbing company like yours…")
- handleOptionDescriptions: exactly 6 values, one per key; each under 90 chars; tailor to THIS business (e.g. salon booking link vs plumber quote form)
- servicesStepSubtitle: one short sentence — what callers might ask THIS business for (no jargon like "request types")
- servicesOfferedLabel: 2–4 words for the main list field (e.g. "Jobs you take", "Cuts and services")
- servicesOfferedPlaceholder: one comma-separated example list tailored to THIS business
- servicesNotOfferedLabel: short label for exclusions (e.g. "Jobs you don't take?")
- servicesNotOfferedPlaceholder: one "We don't…" example tailored to THIS business
- servicesStepHelper: one short reassurance (e.g. "Short list is fine — a few words per item.")
- Plain English, no jargon; do not invent specific prices unless implied by the description`,
        },
        {
          role: "user",
          content: `Business name: ${businessName}
${contextLines ? `${contextLines}\n` : ""}
Owner business description:
${wrapUserContentForPrompt("description", rawBusinessDescription.slice(0, 4000))}`,
        },
      ],
    });

    const parsed = parseOnboardingUiCopyJson(raw, contextKey, input);
    if (parsed) {
      return { ok: true, copy: parsed };
    }
  } catch (err) {
    console.warn("[onboarding-ui-copy] openrouter_failed", err);
  }

  return { ok: true, copy: buildHeuristicOnboardingUiCopy(input) };
}
