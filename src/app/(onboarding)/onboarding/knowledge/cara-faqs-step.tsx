"use client";

import { useMemo } from "react";

import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { MAX_FAQS } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";

import { CaraTrainingStepShell } from "./cara-training-step-shell";
import {
  resolveFaqPlaceholders,
  resolveFaqSuggestions,
} from "./train-cara-faq-suggestions";
import type { FaqSuggestionContext } from "./train-cara-prefill-heuristics";
import { CaraCommonQuestionsField } from "./train-cara-shared";

type Props = {
  title: string;
  subtitle: string;
  helper?: string;
  businessType: string;
  niche: string;
  faqs: AgentFaq[];
  disabled?: boolean;
  suggestContext: FaqSuggestionContext;
  uiCopy?: OnboardingUiCopy | null;
  onChange: (faqs: AgentFaq[]) => void;
};

export function CaraFaqsStep({
  title,
  subtitle,
  helper,
  businessType,
  niche,
  faqs,
  disabled = false,
  suggestContext,
  uiCopy,
  onChange,
}: Props) {
  const suggestions = useMemo(
    () =>
      resolveFaqSuggestions({
        businessType,
        niche,
        context: suggestContext,
        uiCopy,
      }),
    [businessType, niche, suggestContext, uiCopy],
  );

  const placeholders = useMemo(
    () => resolveFaqPlaceholders({ businessType, niche, uiCopy }),
    [businessType, niche, uiCopy],
  );

  return (
    <CaraTrainingStepShell title={title} subtitle={subtitle} helper={helper}>
      <CaraCommonQuestionsField
        faqs={faqs}
        suggestions={suggestions}
        maxFaqs={MAX_FAQS}
        disabled={disabled}
        questionPlaceholder={placeholders.questionPlaceholder}
        answerPlaceholder={placeholders.answerPlaceholder}
        onChange={onChange}
      />
    </CaraTrainingStepShell>
  );
}
