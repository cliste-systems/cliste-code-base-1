import { redirect } from "next/navigation";

import {
  ONBOARDING_STEPS,
  requireOnboardingSession,
} from "@/lib/onboarding-session";
import { createAdminClient } from "@/utils/supabase/admin";

/** Legacy route — test-call step removed; advance to plan if needed. */
export default async function OnboardingTestCallRedirect() {
  const session = await requireOnboardingSession();

  if (session.onboardingStep < ONBOARDING_STEPS.goLive) {
    const admin = createAdminClient();
    await admin
      .from("organizations")
      .update({
        onboarding_step: ONBOARDING_STEPS.goLive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.organizationId);
  }

  redirect("/onboarding/plan");
}
