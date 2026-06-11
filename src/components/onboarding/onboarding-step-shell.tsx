"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import {
  ONBOARDING_LOGO_SIZE,
  ONBOARDING_SHELL_LOGO_GAP,
  ONBOARDING_SHELL_SECTION_GAP,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

import { OnboardingEnter, OnboardingEnterProvider } from "./onboarding-enter";
import { OnboardingStepHeader } from "./onboarding-step-header";

export type OnboardingStepShellVariant = "default" | "wide" | "training" | "profile";

const VARIANT_MAX_WIDTH: Record<OnboardingStepShellVariant, string> = {
  default: "max-w-lg",
  wide: "max-w-6xl",
  training: "max-w-[720px]",
  profile: "max-w-lg lg:max-w-xl",
};

type Props = {
  title?: string;
  /** First name only — rendered as “Hey {name}, {title}”. */
  firstName?: string;
  description?: string;
  children: ReactNode;
  variant?: OnboardingStepShellVariant;
  /** Skip the shell header block; children supply per-step titles (Train Cara). */
  contentOnly?: boolean;
};

export function OnboardingStepShell({
  title,
  firstName,
  description,
  children,
  variant = "default",
  contentOnly = false,
}: Props) {
  const pathname = usePathname();
  const showHeader = !contentOnly && Boolean(title?.trim());
  const isProfile = variant === "profile";
  const enterTone = isProfile ? "profile" : "default";
  const isKnowledge = pathname === "/onboarding/knowledge";
  const showShellLogo = !isKnowledge;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <OnboardingEnterProvider>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="flex min-h-full flex-col items-center px-4 py-6 sm:px-8 sm:py-8">
            <div
              className={cn(
                "my-auto mx-auto flex w-full flex-col items-center",
                VARIANT_MAX_WIDTH[variant],
                ONBOARDING_SHELL_SECTION_GAP,
              )}
            >
              <div
                className={cn(
                  "flex w-full shrink-0 flex-col items-center",
                  showHeader ? ONBOARDING_SHELL_LOGO_GAP : "gap-0",
                )}
              >
                {showShellLogo ? (
                  <OnboardingEnter
                    key={pathname}
                    tone={enterTone}
                    className="flex justify-center"
                  >
                    <ClisteLogoMark
                      size={ONBOARDING_LOGO_SIZE}
                      priority
                      className="mx-auto"
                    />
                  </OnboardingEnter>
                ) : null}

                {showHeader ? (
                  <OnboardingEnter tone={enterTone} className="w-full">
                    <OnboardingStepHeader
                      firstName={firstName}
                      title={title!}
                      subtitle={description}
                    />
                  </OnboardingEnter>
                ) : null}
              </div>

              <div className="flex w-full shrink-0 flex-col items-center">
                {children}
              </div>
            </div>
          </div>
        </div>
      </OnboardingEnterProvider>
    </div>
  );
}
