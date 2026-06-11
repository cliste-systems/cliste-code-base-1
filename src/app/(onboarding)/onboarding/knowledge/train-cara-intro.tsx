"use client";

import { ArrowRight, ChevronLeft } from "lucide-react";

import { OnboardingEnter, OnboardingEnterProvider } from "@/components/onboarding/onboarding-enter";
import { useOnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  ONBOARDING_HEADLINE,
  ONBOARDING_SECONDARY_BUTTON,
  ONBOARDING_STEP_EYEBROW,
  ONBOARDING_SUBHEADLINE,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

type Props = {
  onStart: () => void;
  onBack: () => void;
  onSkip: () => void;
  skipPending?: boolean;
  disabled?: boolean;
};

const INTRO_SECONDARY = cn(
  ONBOARDING_SECONDARY_BUTTON,
  "h-auto min-h-10 w-full px-3 py-2.5 text-[12px] leading-snug shadow-[0_2px_10px_rgba(15,23,42,0.04)] sm:text-[13px]",
);

export function TrainCaraIntro({
  onStart,
  onBack,
  onSkip,
  skipPending = false,
  disabled = false,
}: Props) {
  const busy = disabled || skipPending;
  const { freeNav } = useOnboardingProgress();

  return (
    <OnboardingEnterProvider>
      <div className="flex w-full flex-col items-center text-center">
        <OnboardingEnter className="flex w-full flex-col items-center gap-6">
          <header className="w-full space-y-1.5">
            <p className={ONBOARDING_STEP_EYEBROW}>Train Cara</p>
            <h1 className={ONBOARDING_HEADLINE}>
              <span className="block">Train Cara like someone you&apos;re putting</span>
              <span className="block">on the phone tomorrow.</span>
            </h1>
            <p className={cn(ONBOARDING_SUBHEADLINE, "max-w-md")}>
              Treat the next sections like onboarding a new employee. The more
              Cara knows about your business, the better she&apos;ll handle real
              calls.
            </p>
          </header>

          <div className="flex w-full max-w-[380px] flex-col gap-3">
            <OnboardingPrimaryButton
              type="button"
              pending={false}
              disabled={busy}
              onClick={onStart}
              className="h-11 w-full justify-center px-6"
            >
              Start training Cara
              <ArrowRight className="size-4" aria-hidden />
            </OnboardingPrimaryButton>

            <div
              className={cn(
                "grid gap-2.5",
                freeNav ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              {freeNav ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onBack}
                  className={INTRO_SECONDARY}
                >
                  <ChevronLeft className="size-4 shrink-0" aria-hidden />
                  Back
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={onSkip}
                className={INTRO_SECONDARY}
              >
                {skipPending ? "Skipping…" : "Skip & Set Up Later"}
              </button>
            </div>
          </div>
        </OnboardingEnter>
      </div>
    </OnboardingEnterProvider>
  );
}
