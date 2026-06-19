import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { ownerNameNeedsCapture } from "@/lib/profile-display-name";
import {
  ONBOARDING_STEPS,
  requireOnboardingSession,
} from "@/lib/onboarding-session";
import { parseCaraGoal } from "@/lib/cara-goal";
import { verticalIdForNiche } from "@/lib/verticals";
import { createAdminClient } from "@/utils/supabase/admin";

import { ProfileOnboardingView } from "./profile-onboarding-view";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const session = await requireOnboardingSession();
  guardOnboardingPage(session, "/onboarding/profile");

  const admin = createAdminClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    admin
      .from("organizations")
      .select("name, address, storefront_eircode, niche, agent_business_type, cara_goal")
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
  // Seed the picker only when a real classification already happened. Fresh
  // signups default to niche "other", which shouldn't pre-answer the question.
  const storedNiche = (org?.niche as string | null) ?? null;
  const defaultVertical =
    storedNiche && storedNiche !== "other"
      ? verticalIdForNiche(storedNiche)
      : "";
  const defaultCaraGoal =
    session.onboardingStep > ONBOARDING_STEPS.profile
      ? parseCaraGoal(org?.cara_goal)
      : ("" as const);

  return (
    <ProfileOnboardingView
      businessName={businessName}
      needsOwnerName={needsOwnerName}
      defaultFirstName=""
      defaultLastName=""
      defaultVertical={defaultVertical}
      defaultCaraGoal={defaultCaraGoal}
      defaultAddress={(org?.address as string | null) ?? ""}
      defaultEircode={(org?.storefront_eircode as string | null) ?? ""}
    />
  );
}
