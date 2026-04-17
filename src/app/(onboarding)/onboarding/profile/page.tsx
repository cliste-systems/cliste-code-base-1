import { requireOnboardingSession } from "@/lib/onboarding-session";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  ORGANIZATION_NICHES,
} from "@/lib/organization-niche";
import { createAdminClient } from "@/utils/supabase/admin";

import { WizardStepper } from "../wizard-stepper";

import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const session = await requireOnboardingSession();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, niche, address, storefront_eircode, greeting")
    .eq("id", session.organizationId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper current="profile" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Tell us about your salon
        </h1>
        <p className="max-w-prose text-sm text-gray-600">
          Your AI will introduce itself using these details. Address is used
          for your public booking page and directory search ranking — we only
          store what&apos;s on this form.
        </p>
      </header>

      <ProfileForm
        defaultName={(org?.name as string | null) ?? session.organizationId.slice(0, 8)}
        defaultNiche={(org?.niche as string | null) ?? "hair_salon"}
        defaultAddress={(org?.address as string | null) ?? ""}
        defaultEircode={(org?.storefront_eircode as string | null) ?? ""}
        defaultGreeting={(org?.greeting as string | null) ?? ""}
        niches={ORGANIZATION_NICHES.map((n) => ({
          value: n,
          label: ORGANIZATION_NICHE_ADMIN_LABELS[n],
        }))}
      />
    </div>
  );
}
