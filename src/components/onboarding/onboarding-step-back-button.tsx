"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

import { useOnboardingProgress } from "./onboarding-progress";
import { ONBOARDING_SECONDARY_BUTTON } from "./onboarding-ui";
import { onboardingPreviousPath } from "./onboarding-steps";

/**
 * In-flow "Back" control shown beside each step's Continue button. Navigates to
 * the previous macro onboarding step. Renders nothing on the first step
 * (no previous) or on the knowledge step, which manages its own internal back.
 */
export function OnboardingStepBackButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { freeNav } = useOnboardingProgress();

  // Production funnel is forward-only — back would desync step 2 → step 1.
  if (!freeNav) return null;

  if (
    pathname === "/onboarding/knowledge" ||
    pathname === "/onboarding/test-call"
  ) {
    return null;
  }

  const previous = onboardingPreviousPath(pathname);
  if (!previous) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => router.push(previous))}
      className={cn(ONBOARDING_SECONDARY_BUTTON, className)}
      aria-label="Back to previous step"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Back
    </button>
  );
}
