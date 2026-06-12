import { redirect } from "next/navigation";

import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { getMissingBaseLegalAcceptances } from "@/lib/onboarding-legal-middleware";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { createAdminClient } from "@/utils/supabase/admin";

import { OnboardingLegalAcceptForm } from "./onboarding-legal-accept-form";

export const dynamic = "force-dynamic";

export default async function OnboardingLegalPage() {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();

  const missing = await getMissingBaseLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
  });

  if (missing.length === 0) {
    redirect("/onboarding");
  }

  return (
    <OnboardingStepShell
      variant="wide"
      title="Before we start"
      description="Please review and accept our terms and privacy notice. We keep a timestamped record for compliance."
    >
      <OnboardingLegalAcceptForm missing={missing} />
    </OnboardingStepShell>
  );
}
