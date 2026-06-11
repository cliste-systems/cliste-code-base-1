import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { generateActionsStepExample } from "@/lib/onboarding-actions-example";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { createClient } from "@/utils/supabase/server";

import { OnboardingActionsView } from "./onboarding-actions-view";

export const dynamic = "force-dynamic";

export default async function OnboardingActionsPage() {
  const session = await requireOnboardingSession();

  guardOnboardingPage(session, "/onboarding/actions");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, niche, agent_business_type, raw_business_description, agent_services_departments, business_knowledge_summary",
    )
    .eq("id", session.organizationId)
    .maybeSingle();

  const example = await generateActionsStepExample({
    businessName: String(org?.name ?? "").trim(),
    businessType: (org?.agent_business_type as string | null) ?? null,
    niche: (org?.niche as string | null) ?? null,
    rawBusinessDescription: (org?.raw_business_description as string | null) ?? "",
    servicesOffered: (org?.agent_services_departments as string | null) ?? "",
    knowledgeSummary: (org?.business_knowledge_summary as string | null) ?? "",
  });

  return (
    <OnboardingStepShell
      variant="training"
      title="What Cara does on calls"
      description="A quick overview. You will set up links, files, and handoffs in Routing in your dashboard."
    >
      <OnboardingActionsView example={example} />
    </OnboardingStepShell>
  );
}
