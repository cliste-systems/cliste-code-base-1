import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  ensureFallbackRoute,
  routesFromStoredLinks,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { defaultBusinessDescription } from "@/lib/onboarding-business-type";
import { guardOnboardingPage } from "@/lib/onboarding-page-guard";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { createClient } from "@/utils/supabase/server";

import { aboutTextForStep } from "./train-cara-about-text";
import { parseHandleOptions } from "./cara-handle-routes";
import {
  resolveTrainCaraStepIndex,
  shouldShowTrainCaraIntro,
} from "./train-cara-step-resume";
import { parseStoredOnboardingUiCopy } from "@/lib/onboarding-ui-copy";
import {
  parseAgentBusinessRules,
  stripBusinessRulesFromSummary,
} from "@/lib/agent-business-rules";
import { TrainCaraFlow } from "./train-cara-flow";

export const dynamic = "force-dynamic";

export default async function OnboardingKnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string | string[] }>;
}) {
  const session = await requireOnboardingSession();

  guardOnboardingPage(session, "/onboarding/knowledge");

  const params = (await searchParams) ?? {};
  const urlStepId = Array.isArray(params.step) ? params.step[0] : params.step;

  const supabase = await createClient();
  const [{ data: org }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, address, storefront_eircode, niche, agent_business_type, agent_location_address, raw_business_description, business_knowledge_summary, agent_opening_hours, agent_service_area, agent_services_departments, agent_services_not_offered, agent_details_to_collect, agent_faqs, agent_capture_fields, agent_business_rules, cara_handle_options, routing_links, fallback_number, notification_email, notification_phone, onboarding_ui_copy, train_cara_step",
      )
      .eq("id", session.organizationId)
      .maybeSingle(),
  ]);

  const niche = (org?.niche as string | null) ?? "";
  const handleOptions = parseHandleOptions(org?.cara_handle_options);
  const storedLinks = parseRoutingLinks(
    (org?.routing_links as unknown) ?? null,
  );
  const routes = ensureFallbackRoute(
    storedLinks.length > 0 ? routesFromStoredLinks(storedLinks) : [],
  );

  const linkUrl =
    routes.find((r) => r.outcome === "send_link")?.url ?? "";
  const whatsappContact =
    routes.find((r) => r.outcome === "whatsapp")?.whatsapp ?? "";
  const routeEmail = routes.find((r) => r.outcome === "email")?.email ?? "";
  const transferPhone = (org?.fallback_number as string | null) ?? "";

  const about = aboutTextForStep(
    (org?.raw_business_description as string | null) ?? "",
  );
  const savedSummaryRaw =
    (org?.business_knowledge_summary as string | null) ?? "";
  const businessRules = parseAgentBusinessRules(org?.agent_business_rules);
  const compiledNotes = stripBusinessRulesFromSummary(savedSummaryRaw);

  const classifiedBusinessType = defaultBusinessDescription({
    niche: (org?.niche as string | null) ?? null,
    agentBusinessType: (org?.agent_business_type as string | null) ?? null,
  });
  const servicesOffered =
    (org?.agent_services_departments as string | null) ?? "";
  const servicesNotOffered =
    (org?.agent_services_not_offered as string | null) ?? "";
  const openingHours = (org?.agent_opening_hours as string | null) ?? "";
  const serviceArea = (org?.agent_service_area as string | null) ?? "";
  const detailsToCollect =
    (org?.agent_details_to_collect as string | null)?.trim() ?? "";
  const faqs = parseAgentFaqs(org?.agent_faqs);
  const onboardingUiCopy = parseStoredOnboardingUiCopy(org?.onboarding_ui_copy);

  const savedStepId = (org?.train_cara_step as string | null) ?? null;

  const showIntro = shouldShowTrainCaraIntro({ savedStepId });

  const initialStepIndex = resolveTrainCaraStepIndex({
    urlStepId,
    savedStepId,
  });

  return (
    <OnboardingStepShell variant="training" contentOnly>
      <TrainCaraFlow
        initial={{
          businessName: (org?.name as string | null) ?? "",
          about,
          servicesOffered,
          servicesNotOffered,
          openingHours,
          serviceArea,
          detailsToCollect,
          businessRules,
          compiledNotes,
          faqs,
          businessType: classifiedBusinessType,
          niche,
          handleOptions,
          routes,
          linkLabel: "",
          linkUrl,
          emailAddress:
            routeEmail || ((org?.notification_email as string | null) ?? ""),
          whatsappContact,
          meetingLink: "",
          transferPhone,
          onboardingUiCopy,
          showIntro,
          initialStepIndex,
        }}
      />
    </OnboardingStepShell>
  );
}
