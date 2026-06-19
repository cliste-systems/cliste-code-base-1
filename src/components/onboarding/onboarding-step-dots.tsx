"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  ONBOARDING_STEPS_META,
  ONBOARDING_TOTAL_STEPS,
  normalizeOnboardingPath,
  onboardingStepIndex,
} from "./onboarding-steps";
import { useOnboardingProgress } from "./onboarding-progress";

export function OnboardingStepDots() {
  const pathname = usePathname();
  const { furthestDbStep } = useOnboardingProgress();

  const currentPath = normalizeOnboardingPath(pathname);
  const current = onboardingStepIndex(pathname);
  const progressStep = Math.min(
    ONBOARDING_TOTAL_STEPS,
    Math.max(current, furthestDbStep),
  );

  const activeMeta =
    ONBOARDING_STEPS_META.find((step) => step.path === currentPath) ??
    ONBOARDING_STEPS_META[current - 1];

  return (
    <div
      className="flex w-full shrink-0 flex-col items-center gap-2.5 px-4 pb-6 pt-2 sm:px-6"
      role="progressbar"
      aria-valuenow={progressStep}
      aria-valuemin={1}
      aria-valuemax={ONBOARDING_TOTAL_STEPS}
      aria-label={`Step ${current} of ${ONBOARDING_TOTAL_STEPS}: ${activeMeta?.label ?? "Onboarding"}`}
    >
      <p className="text-[11px] font-medium tracking-[0.06em] text-slate-500 uppercase">
        Step {current} of {ONBOARDING_TOTAL_STEPS}
        {activeMeta ? (
          <span className="normal-case tracking-normal text-slate-400">
            {" "}
            · {activeMeta.label}
          </span>
        ) : null}
      </p>

      <div className="flex w-full max-w-md items-center justify-between gap-1">
        {ONBOARDING_STEPS_META.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = step.path === currentPath;
          const isComplete = stepNumber < progressStep;
          const isReachable = stepNumber <= progressStep;

          return (
            <div
              key={step.path}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              aria-hidden
            >
              <span
                className={cn(
                  "rounded-full transition-all duration-200",
                  isCurrent
                    ? "size-2 bg-[#0b1220]"
                    : isComplete
                      ? "size-1.5 bg-[#0b1220]/70"
                      : isReachable
                        ? "size-1.5 bg-[#0b1220]/40"
                        : "size-1 bg-[#0b1220]/15",
                )}
              />
              <span
                className={cn(
                  "hidden w-full truncate text-center text-[9px] font-medium leading-none sm:block",
                  isCurrent
                    ? "text-[#0b1220]"
                    : isReachable
                      ? "text-slate-500"
                      : "text-slate-300",
                )}
              >
                {step.shortLabel}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex w-full max-w-md gap-1">
        {ONBOARDING_STEPS_META.map((step, index) => {
          const stepNumber = index + 1;
          const filled = stepNumber <= progressStep;
          return (
            <div
              key={`${step.path}-bar`}
              className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[#0b1220]/10"
              aria-hidden
            >
              <div
                className={cn(
                  "h-full rounded-full bg-[#0b1220] transition-[width] duration-500 ease-out",
                  filled ? "w-full" : "w-0",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
