"use client";

import { useMemo } from "react";

import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { MAX_FAQS } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";

import { CaraTrainingStepShell } from "./cara-training-step-shell";
import { resolveFaqPlaceholders } from "./train-cara-faq-suggestions";
import type { TrainCaraFaqGuardContext } from "./train-cara-faq-guardrails";
import { TrainCaraInlineNotice } from "./train-cara-inline-notice";
import { CaraCommonQuestionsField } from "./train-cara-shared";

type Props = {
  title: string;
  subtitle: string;
  helper?: string;
  businessType: string;
  niche: string;
  faqs: AgentFaq[];
  disabled?: boolean;
  guardContext: TrainCaraFaqGuardContext;
  strippedNotice?: string | null;
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
  guardContext,
  strippedNotice,
  onChange,
}: Props) {
  const placeholders = useMemo(
    () => resolveFaqPlaceholders({ businessType, niche }),
    [businessType, niche],
  );

  return (
    <CaraTrainingStepShell title={title} subtitle={subtitle} helper={helper}>
      <TrainCaraInlineNotice message={strippedNotice ?? undefined} tone="attention" />
      <CaraCommonQuestionsField
        faqs={faqs}
        maxFaqs={MAX_FAQS}
        disabled={disabled}
        guardContext={guardContext}
        questionPlaceholder={placeholders.questionPlaceholder}
        answerPlaceholder={placeholders.answerPlaceholder}
        onChange={onChange}
      />
    </CaraTrainingStepShell>
  );
}
