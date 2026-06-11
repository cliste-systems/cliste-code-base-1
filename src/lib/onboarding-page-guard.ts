import "server-only";

import { redirect } from "next/navigation";

import type { OnboardingStepPath } from "@/components/onboarding/onboarding-steps";
import { enforceOnboardingStepOrder } from "@/lib/onboarding-dev";
import {
  type OnboardingSession,
  resolveCurrentStepPath,
} from "@/lib/onboarding-session";

/**
 * When step order is enforced, the org may only view the single macro step that
 * matches `organizations.onboarding_step`. Prevents "step 2 → back → step 1"
 * drift and keeps the footer progress in sync with the funnel.
 */
export function guardOnboardingPage(
  session: OnboardingSession,
  pagePath: OnboardingStepPath,
): void {
  if (!enforceOnboardingStepOrder()) return;

  const canonical = resolveCurrentStepPath(session);

  if (canonical !== pagePath) {
    redirect(canonical);
  }
}
