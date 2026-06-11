import type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";

import {
  deterministicFaqSuggestions,
  type FaqSuggestionContext,
} from "./train-cara-prefill-heuristics";
import { detectTradePack } from "./train-cara-trade-topics";

const SALON_FAQ_UI_HINT =
  /\b(walk.?in|balayage|blow.?dry|colour|color|highlight|beard trim|nail|salon)\b/i;

function barberFaqSuggestions(): string[] {
  return [
    "Do you take walk-ins?",
    "How much is a skin fade?",
    "Do you do beard trims?",
  ];
}

function hairSalonFaqSuggestions(): string[] {
  return [
    "Do you take walk-ins?",
    "How much is a cut and colour?",
    "How far ahead should I book?",
  ];
}

function plumberFaqSuggestions(): string[] {
  return [
    "Do you offer emergency callouts?",
    "What areas do you cover?",
    "How much does a callout cost?",
  ];
}

function electricianFaqSuggestions(): string[] {
  return [
    "Do you do emergency callouts?",
    "Can you do fuse board upgrades?",
    "What areas do you cover?",
  ];
}

function heatingFaqSuggestions(): string[] {
  return [
    "Do you repair boilers?",
    "How much is a boiler service?",
    "Do you offer no-heating emergencies?",
  ];
}

function tradesFaqSuggestions(businessType: string): string[] {
  const lower = businessType.toLowerCase();
  if (lower.includes("electric")) return electricianFaqSuggestions();
  if (lower.includes("heat") || lower.includes("boiler")) return heatingFaqSuggestions();
  if (lower.includes("plumb")) return plumberFaqSuggestions();
  return [
    "Do you offer emergency callouts?",
    "What areas do you cover?",
    "How quickly can someone come out?",
  ];
}

function defaultFaqSuggestions(businessType: string): string[] {
  const label = businessType.trim();
  if (label) {
    return [
      `How much does ${label} cost?`,
      "How do I get started?",
      "What areas do you cover?",
    ];
  }
  return [
    "How much does it cost?",
    "How do I get started?",
    "What should I expect?",
  ];
}

export function packFaqSuggestionsForBusiness(
  businessType: string,
  niche: string,
): string[] {
  if (niche === "barber") return barberFaqSuggestions();
  if (niche === "hair_salon") return hairSalonFaqSuggestions();

  const pack = detectTradePack(businessType);
  if (pack === "trades") return tradesFaqSuggestions(businessType);
  if (pack === "salon") return hairSalonFaqSuggestions();
  return defaultFaqSuggestions(businessType);
}

function shouldUseFaqUiCopy(
  businessType: string,
  suggestions: string[] | undefined,
): suggestions is string[] {
  if (!suggestions?.length) return false;
  if (detectTradePack(businessType) !== "trades") return true;

  const blob = suggestions.join(" ");
  return !SALON_FAQ_UI_HINT.test(blob);
}

function uniqueSuggestions(lists: string[][], max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    for (const question of list) {
      const trimmed = question.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
      if (out.length >= max) break;
    }
    if (out.length >= max) break;
  }

  return out;
}

export function resolveFaqSuggestions(input: {
  businessType: string;
  niche: string;
  context: FaqSuggestionContext;
  uiCopy?: OnboardingUiCopy | null;
}): string[] {
  const packBase = packFaqSuggestionsForBusiness(
    input.businessType,
    input.niche,
  );
  const contextual = deterministicFaqSuggestions(input.context);
  const uiSuggestions = shouldUseFaqUiCopy(
    input.businessType,
    input.uiCopy?.faqSuggestions,
  )
    ? input.uiCopy.faqSuggestions
    : [];

  // AI copy is primary for every vertical; the hardcoded pack is only a fallback.
  // `shouldUseFaqUiCopy` still guards against salon-flavoured copy on trades.
  const lists = [uiSuggestions, contextual, packBase];

  return uniqueSuggestions(lists, 3);
}

export function resolveFaqPlaceholders(input: {
  businessType: string;
  niche: string;
  uiCopy?: OnboardingUiCopy | null;
}): {
  questionPlaceholder: string;
  answerPlaceholder: string;
} {
  const pack = detectTradePack(input.businessType);
  const isBarber = input.niche === "barber";
  const isSalon =
    input.niche === "hair_salon" || (pack === "salon" && !isBarber);

  const questionFallback = isBarber
    ? "e.g. Do you take walk-ins?"
    : isSalon
      ? "e.g. Do you take walk-ins?"
      : pack === "trades"
        ? "e.g. Do you do emergency callouts?"
        : "e.g. How much does it cost?";

  const answerFallback = isBarber
    ? "e.g. Walk-ins welcome before 5pm — fades need 30 mins."
    : isSalon
      ? "e.g. Walk-ins before 4pm; colour needs booking."
      : pack === "trades"
        ? "e.g. Yes for burst pipes — standard jobs Mon–Sat."
        : "e.g. We quote after a quick chat about the job.";

  return {
    questionPlaceholder:
      input.uiCopy?.questionPlaceholder?.trim() || questionFallback,
    answerPlaceholder:
      input.uiCopy?.answerPlaceholder?.trim() || answerFallback,
  };
}
