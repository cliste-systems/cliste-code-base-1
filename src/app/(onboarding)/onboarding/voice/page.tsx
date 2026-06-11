import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { createAdminClient } from "@/utils/supabase/admin";

import { VoiceForm } from "./voice-form";

export const dynamic = "force-dynamic";

export default async function OnboardingVoicePage() {
  const session = await requireOnboardingSession();

  guardOnboardingPage(session, "/onboarding/voice");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, greeting")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = (org?.name as string | null) ?? "";

  return (
    <OnboardingStepShell
      variant="profile"
      title="How Cara greets callers"
      description="Set Cara's opening line and listen to how she'll sound on calls."
    >
      <VoiceForm
        businessName={businessName}
        defaultGreeting={(org?.greeting as string | null)?.trim() ?? ""}
      />
    </OnboardingStepShell>
  );
}
