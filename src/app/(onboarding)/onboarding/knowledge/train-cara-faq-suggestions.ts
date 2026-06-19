import type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";

import { verticalIdForNiche } from "@/lib/verticals";

import {
  deterministicFaqSuggestions,
  type FaqSuggestionContext,
} from "./train-cara-prefill-heuristics";

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
  if (verticalIdForNiche(niche) !== "salon_beauty") {
    return defaultFaqSuggestions(businessType);
  }
  if (niche === "barber") return barberFaqSuggestions();
  return hairSalonFaqSuggestions();
}

function shouldUseFaqUiCopy(
  niche: string,
  suggestions: string[] | undefined,
): suggestions is string[] {
  if (!suggestions?.length) return false;
  if (verticalIdForNiche(niche) === "salon_beauty") {
    const blob = suggestions.join(" ");
    return !SALON_FAQ_UI_HINT.test(blob);
  }
  return true;
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
    input.niche,
    input.uiCopy?.faqSuggestions,
  )
    ? input.uiCopy.faqSuggestions
    : [];

  const isSalon = verticalIdForNiche(input.niche) === "salon_beauty";
  const lists = isSalon
    ? [packBase, uiSuggestions, contextual]
    : [uiSuggestions, packBase, contextual];

  return uniqueSuggestions(lists, isSalon ? 4 : 3);
}

export function resolveFaqPlaceholders(input: {
  businessType: string;
  niche: string;
  uiCopy?: OnboardingUiCopy | null;
}): {
  questionPlaceholder: string;
  answerPlaceholder: string;
} {
  const isBarber = input.niche === "barber";
  const isSalon = verticalIdForNiche(input.niche) === "salon_beauty";

  const questionFallback = isSalon
    ? isBarber
      ? "e.g. Do you take walk-ins?"
      : "e.g. Do you take walk-ins?"
    : "e.g. How much does it cost?";

  const answerFallback = isSalon
    ? isBarber
      ? "e.g. Walk-ins welcome before 5pm — fades need 30 mins."
      : "e.g. Walk-ins before 4pm; colour needs booking."
    : "e.g. We quote after a quick chat about the job.";

  return {
    questionPlaceholder:
      input.uiCopy?.questionPlaceholder?.trim() || questionFallback,
    answerPlaceholder:
      input.uiCopy?.answerPlaceholder?.trim() || answerFallback,
  };
}
