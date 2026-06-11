import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { defaultBusinessDescription } from "@/lib/onboarding-business-type";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { ownerNameNeedsCapture } from "@/lib/profile-display-name";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { verticalIdForNiche } from "@/lib/verticals";
import { createAdminClient } from "@/utils/supabase/admin";

import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const session = await requireOnboardingSession();
  guardOnboardingPage(session, "/onboarding/profile");

  const admin = createAdminClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    admin
      .from("organizations")
      .select("name, address, storefront_eircode, niche, agent_business_type")
      .eq("id", session.organizationId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("name")
      .eq("id", session.user.id)
      .maybeSingle(),
  ]);

  const businessName = (org?.name as string | null) ?? "";
  const profileName = (profile?.name as string | null) ?? "";
  const needsOwnerName = ownerNameNeedsCapture(profileName, businessName);
  const businessDescriptionDefault = defaultBusinessDescription({
    niche: (org?.niche as string | null) ?? null,
    agentBusinessType: (org?.agent_business_type as string | null) ?? null,
  });
  // Seed the picker only when a real classification already happened. Fresh
  // signups default to niche "other", which shouldn't pre-answer the question.
  const storedNiche = (org?.niche as string | null) ?? null;
  const defaultVertical =
    storedNiche && storedNiche !== "other"
      ? verticalIdForNiche(storedNiche)
      : "";

  return (
    <OnboardingStepShell
      variant="profile"
      title="Tell us about your business"
      description="A few details so Cara can answer calls the way you would."
    >
      <ProfileForm
        businessName={businessName}
        needsOwnerName={needsOwnerName}
        defaultFirstName=""
        defaultLastName=""
        defaultBusinessDescription={businessDescriptionDefault}
        defaultVertical={defaultVertical}
        defaultAddress={(org?.address as string | null) ?? ""}
        defaultEircode={(org?.storefront_eircode as string | null) ?? ""}
      />
    </OnboardingStepShell>
  );
}
