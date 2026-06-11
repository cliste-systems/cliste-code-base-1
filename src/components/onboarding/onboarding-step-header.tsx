import { cn } from "@/lib/utils";

import {
  ONBOARDING_HEADLINE,
  ONBOARDING_HEADLINE_NAME,
  ONBOARDING_PROFILE_EYEBROW,
  ONBOARDING_PROFILE_HEADLINE,
  ONBOARDING_PROFILE_SUBHEADLINE,
  ONBOARDING_STEP_EYEBROW,
  ONBOARDING_SUBHEADLINE,
} from "./onboarding-ui";

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  firstName?: string;
  className?: string;
  subtitleClassName?: string;
  tone?: "default" | "profile";
};

export function OnboardingStepHeader({
  title,
  subtitle,
  eyebrow,
  firstName,
  className,
  subtitleClassName,
  tone = "default",
}: Props) {
  const isProfile = tone === "profile";

  return (
    <header
      className={cn(
        "w-full space-y-2",
        isProfile ? "text-left" : "space-y-1.5 text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className={isProfile ? ONBOARDING_PROFILE_EYEBROW : ONBOARDING_STEP_EYEBROW}>
          {eyebrow}
        </p>
      ) : null}
      {firstName ? (
        <h1 className={isProfile ? ONBOARDING_PROFILE_HEADLINE : ONBOARDING_HEADLINE}>
          <span className="block text-[1.125rem] font-medium text-slate-600 sm:text-[1.25rem]">
            Hey <span className={ONBOARDING_HEADLINE_NAME}>{firstName}</span>
          </span>
          <span className="block">{title}</span>
        </h1>
      ) : (
        <h1 className={isProfile ? ONBOARDING_PROFILE_HEADLINE : ONBOARDING_HEADLINE}>
          {title}
        </h1>
      )}
      {subtitle ? (
        <p
          className={cn(
            isProfile ? ONBOARDING_PROFILE_SUBHEADLINE : ONBOARDING_SUBHEADLINE,
            !isProfile && (subtitleClassName ?? "max-w-md"),
            isProfile && subtitleClassName,
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
