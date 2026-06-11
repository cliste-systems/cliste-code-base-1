import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";

import { TestCallView } from "./test-call-view";

export const dynamic = "force-dynamic";

export default async function OnboardingTestCallPage() {
  const session = await requireOnboardingSession();

  guardOnboardingPage(session, "/onboarding/test-call");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("phone_number, agent_faqs")
    .eq("id", session.organizationId)
    .maybeSingle();

  let phoneNumber = (org?.phone_number as string | null)?.trim() || null;
  if (!phoneNumber) {
    const provisioned = await provisionOrganizationPhoneNumber(
      session.organizationId,
    );
    if (provisioned.ok) {
      phoneNumber = provisioned.e164;
    }
  }

  const suggestedPrompts = buildSuggestedPrompts(org?.agent_faqs);

  return (
    <OnboardingStepShell
      title="Say hello to your new number"
      description="Give Cara a quick ring from your phone to test her out."
    >
      <TestCallView
        phoneNumber={phoneNumber}
        allowProceedWithoutCall={process.env.NODE_ENV === "development"}
        suggestedPrompts={suggestedPrompts}
      />
    </OnboardingStepShell>
  );
}

const FALLBACK_PROMPTS = [
  "What are your opening hours?",
  "Do you have availability this week?",
  "Can I speak to someone?",
] as const;

/** Turn FAQs into things to try on the test call; pad with sensible defaults. */
function buildSuggestedPrompts(rawFaqs: unknown): string[] {
  const prompts: string[] = [];
  const seen = new Set<string>();
  const faqs = parseAgentFaqs(rawFaqs);

  for (const faq of faqs) {
    const q = String(faq?.question ?? "").trim();
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    prompts.push(q);
    if (prompts.length >= 2) break;
  }

  for (const fallback of FALLBACK_PROMPTS) {
    if (prompts.length >= 3) break;
    const key = fallback.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    prompts.push(fallback);
  }

  return prompts.slice(0, 3);
}
