import { redirect } from "next/navigation";

import {
  requireOnboardingSession,
  resolveCurrentStepPath,
} from "@/lib/onboarding-session";

export const dynamic = "force-dynamic";

export default async function OnboardingRootPage() {
  const session = await requireOnboardingSession();
  redirect(resolveCurrentStepPath(session));
}
