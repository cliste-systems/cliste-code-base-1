"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useTransition } from "react";

import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import type { ActionsStepExample } from "@/lib/onboarding-actions-example-shared";
import { cn } from "@/lib/utils";

import { TRAINING_SURFACE } from "../knowledge/cara-training-step-shell";
import { skipOnboardingActions } from "./actions";

const CARA_ON_CALL_STEPS = [
  {
    title: "Answer questions",
    body: "On the call, she uses what you taught her — services, hours, FAQs, and how you work.",
  },
  {
    title: "Send links or files",
    body: "When callers want to book, see a menu, or get a price list, she texts them the right link or document.",
  },
  {
    title: "Pass to your team",
    body: "For jobs that need a person, she emails your team a summary or adds a structured follow-up to your Action Inbox.",
  },
  {
    title: "Take a message",
    body: "If nothing else fits, she captures their name, number, and what they need.",
  },
] as const;

type Props = {
  example: ActionsStepExample;
};

export function OnboardingActionsView({ example }: Props) {
  const [continuing, startContinue] = useTransition();

  function handleContinue() {
    startContinue(async () => {
      await skipOnboardingActions();
    });
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <OnboardingEnter className="w-full">
        <article className={cn(TRAINING_SURFACE, "w-full px-5 py-5 sm:px-6 sm:py-6")}>
          <ol className="space-y-4">
            {CARA_ON_CALL_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3.5 text-left">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0b1220]/[0.06] text-[12px] font-medium text-[#0b1220]"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[14px] font-medium leading-snug text-[#0b1220]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-slate-200/80 pt-4 text-[13px] leading-relaxed text-slate-600">
            You will choose which of these Cara can do and wire up the details in{" "}
            <span className="font-medium text-[#0b1220]">Routing</span> in your
            dashboard after onboarding.
          </p>
        </article>
      </OnboardingEnter>

      <OnboardingEnter className="w-full">
        <article
          className={cn(
            TRAINING_SURFACE,
            "w-full border-dashed border-[#0b1220]/15 bg-[#0b1220]/[0.02] px-5 py-4 sm:px-6 sm:py-5",
          )}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-[#0b1220]" aria-hidden />
            <p className="text-[11px] font-medium tracking-[0.08em] text-slate-500 uppercase">
              Example for your business
            </p>
          </div>
          <p className="text-left text-[13px] leading-relaxed text-slate-600">
            You could set up{" "}
            <span className="font-medium text-[#0b1220]">{example.setup}</span> to{" "}
            {example.does}.
          </p>
        </article>
      </OnboardingEnter>

      <OnboardingEnter className="flex w-full justify-center">
        <OnboardingPrimaryButton
          type="button"
          pending={continuing}
          onClick={handleContinue}
          className="min-w-[12rem]"
        >
          {continuing ? "Continuing…" : "Continue"}
          {!continuing ? <ArrowRight className="size-4" aria-hidden /> : null}
        </OnboardingPrimaryButton>
      </OnboardingEnter>
    </div>
  );
}
