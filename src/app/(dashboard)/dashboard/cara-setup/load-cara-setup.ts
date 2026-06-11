import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import {
  emptyWeekSchedule,
  isBusinessHoursUnset,
  parseBusinessHoursBundle,
} from "@/lib/business-hours";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { buildCaraSetupPromptInputFromOrg } from "@/lib/cara-prompt-from-org";
import { normalizeServiceAreaCountyItems } from "@/lib/service-area-boundary";
import { VOICE_ASSISTANT_DEFAULT_NAME } from "@/lib/voice-greeting";

import { listBusinessFiles } from "../agent-setup/business-files-actions";
import { parseAgentFaqs } from "../agent-setup/agent-faqs";
import type { AgentSetupInitial } from "../agent-setup/agent-setup-helpers";
import type { BusinessFileListItem } from "@/lib/business-files";

import type { CaraSetupPromptInput } from "@/lib/compile-cara-prompt";

export type CaraSetupPageData = {
  initial: AgentSetupInitial;
  businessFiles: BusinessFileListItem[];
  /** Routing + transfer fields for prompt preview (from Call Flow). */
  promptExtras: Pick<
    CaraSetupPromptInput,
    "routes" | "fallbackNote" | "transferNumber"
  >;
};

export async function loadCaraSetupPageData(): Promise<CaraSetupPageData> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, address, storefront_eircode, assistant_display_name, greeting, custom_prompt, agent_business_type, agent_faqs, agent_opening_hours, agent_service_area, agent_service_area_exclusions, agent_services_departments, agent_services_not_offered, agent_details_to_collect, agent_business_rules, agent_location_address, agent_location_eircode, business_hours, business_knowledge_summary, routing_links, fallback_number, call_routing_mode",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const assistant = VOICE_ASSISTANT_DEFAULT_NAME;

  const businessFiles = await listBusinessFiles();
  const hoursUnset = isBusinessHoursUnset(org?.business_hours);
  const hoursBundle = hoursUnset
    ? { schedule: emptyWeekSchedule(), meta: {} }
    : parseBusinessHoursBundle(org?.business_hours);

  const servicesOffered = (org?.agent_services_departments as string | null) ?? "";
  const servicesNotOffered =
    (org?.agent_services_not_offered as string | null) ?? "";
  const openingHoursLegacy = (org?.agent_opening_hours as string | null) ?? "";
  const serviceArea = (org?.agent_service_area as string | null) ?? "";
  const serviceAreaExclusions =
    (org?.agent_service_area_exclusions as string | null) ?? "";
  const faqs = parseAgentFaqs(org?.agent_faqs);

  const promptFromOrg = buildCaraSetupPromptInputFromOrg(org);

  return {
    businessFiles,
    promptExtras: {
      routes: promptFromOrg.routes,
      fallbackNote: promptFromOrg.fallbackNote,
      transferNumber: promptFromOrg.transferNumber,
    },
    initial: {
      businessName: (org?.name as string | null) ?? "",
      assistantDisplayName: assistant,
      greeting: (org?.greeting as string | null) ?? "",
      businessType: (org?.agent_business_type as string | null) ?? "",
      faqs,
      openingHoursSchedule: hoursBundle.schedule,
      openingHoursLegacy: hoursUnset ? openingHoursLegacy : "",
      hoursNeverConfigured: hoursUnset,
      open24_7: hoursBundle.meta.open24_7 === true,
      hoursNote: hoursBundle.meta.hoursNote ?? "",
      serviceAreaItems: normalizeServiceAreaCountyItems(
        parseAgentKnowledgeList(serviceArea),
      ),
      serviceAreaExclusionItems: parseAgentKnowledgeList(serviceAreaExclusions),
      servicesItems: parseAgentKnowledgeList(servicesOffered),
      servicesNotOfferedItems: parseAgentKnowledgeList(servicesNotOffered),
      detailsToCollectItems: parseAgentKnowledgeList(
        (org?.agent_details_to_collect as string | null) ?? "",
      ),
      businessRules: parseAgentBusinessRules(org?.agent_business_rules),
      locationAddress:
        (org?.agent_location_address as string | null)?.trim() ||
        (org?.address as string | null)?.trim() ||
        "",
      locationEircode:
        (org?.agent_location_eircode as string | null)?.trim() ||
        (org?.storefront_eircode as string | null)?.trim() ||
        "",
    },
  };
}
