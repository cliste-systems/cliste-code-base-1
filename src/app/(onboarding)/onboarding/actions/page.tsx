import { redirect } from "next/navigation";

import {
  requireOnboardingSession,
  resolveCurrentStepPath,
} from "@/lib/onboarding-session";

export const dynamic = "force-dynamic";

/** Legacy route — the actions overview step was removed from onboarding. */
export default async function LegacyOnboardingActionsRedirect() {
  const session = await requireOnboardingSession();
  redirect(resolveCurrentStepPath(session));
}
