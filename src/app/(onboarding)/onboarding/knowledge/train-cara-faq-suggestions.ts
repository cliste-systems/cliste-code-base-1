import type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";

import { verticalIdForNiche } from "@/lib/verticals";

import type { FaqSuggestionContext } from "./train-cara-prefill-heuristics";

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

export function resolveFaqSuggestions(input: {
  businessType: string;
  niche: string;
  context?: FaqSuggestionContext;
  uiCopy?: OnboardingUiCopy | null;
}): string[] {
  return packFaqSuggestionsForBusiness(input.businessType, input.niche);
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
    ? "e.g. Do you take walk-ins?"
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
