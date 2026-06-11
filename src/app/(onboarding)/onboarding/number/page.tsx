import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import {
  DEFAULT_CALL_ROUTING_MODE,
  parseCallRoutingMode,
} from "@/lib/call-routing";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import {
  ONBOARDING_STEPS,
  requireOnboardingSession,
} from "@/lib/onboarding-session";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";

import { OnboardingNumberView } from "./onboarding-number-view";

export const dynamic = "force-dynamic";

export default async function OnboardingNumberPage() {
  const session = await requireOnboardingSession();

  guardOnboardingPage(session, "/onboarding/number");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("phone_number, call_routing_mode, fallback_number")
    .eq("id", session.organizationId)
    .maybeSingle();

  // Provision the Cliste DID here so it can be shown as the forward target and
  // verified on the next (test call) step.
  let phoneNumber = (org?.phone_number as string | null)?.trim() || null;
  if (!phoneNumber) {
    const provisioned = await provisionOrganizationPhoneNumber(
      session.organizationId,
    );
    if (provisioned.ok) phoneNumber = provisioned.e164;
  }

  return (
    <OnboardingStepShell
      title="How should calls reach Cara?"
      description="Use your new Cliste number, or keep your current number and forward calls to Cara."
    >
      <OnboardingNumberView
        phoneNumber={phoneNumber}
        initialMode={
          session.onboardingStep > ONBOARDING_STEPS.number
            ? parseCallRoutingMode(org?.call_routing_mode)
            : DEFAULT_CALL_ROUTING_MODE
        }
        initialTransferPhone={(org?.fallback_number as string | null) ?? ""}
      />
    </OnboardingStepShell>
  );
}
