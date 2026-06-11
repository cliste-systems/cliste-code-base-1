import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { listBusinessFilesForOrg } from "@/lib/business-files-server";
import {
  isFallbackRoute,
  routeKeywords,
  routesFromStoredLinks,
  type RouteOutcomeKind,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import {
  isBusinessHoursUnset,
  parseBusinessHoursBundle,
} from "@/lib/business-hours";
import {
  compileCaraPrompt,
  type CaraSetupPromptInput,
} from "@/lib/compile-cara-prompt";
import { VOICE_ASSISTANT_DEFAULT_NAME } from "@/lib/voice-greeting";
import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
} from "@/lib/call-routing";

const PROMPT_ORG_COLUMNS =
  "name, assistant_display_name, greeting, agent_business_type, business_knowledge_summary, agent_opening_hours, business_hours, agent_service_area, agent_service_area_exclusions, agent_services_departments, agent_services_not_offered, agent_details_to_collect, agent_business_rules, agent_faqs, agent_location_address, agent_location_eircode, routing_links, fallback_number, call_routing_mode";

type PromptOrgRow = Record<string, unknown>;

/** What Cara should do for each saved outcome, phrased for the call prompt. */
function actionPhraseForOutcome(outcome: RouteOutcomeKind): string {
  switch (outcome) {
    case "send_link":
      return "text them the saved link";
    case "send_file":
      return "send them the saved file";
    case "email":
      return "take their details and email the team";
    case "whatsapp":
      return "follow up with them on WhatsApp";
    case "transfer":
      return "try to put them through to the team";
    case "action_inbox":
    default:
      return "take a message for the team";
  }
}

/** Trigger -> action pairs from the saved call flow (fallback handled separately). */
function routingRoutesFromLinks(rawLinks: unknown): RoutingActionSummary[] {
  const routes = routesFromStoredLinks(parseRoutingLinks(rawLinks ?? null));
  return routes
    .filter((r) => r.active && !isFallbackRoute(r) && routeKeywords(r))
    .map((r) => ({
      trigger: routeKeywords(r),
      action: actionPhraseForOutcome(r.outcome),
      instruction: r.description?.trim() || undefined,
    }));
}

/** The "Anything else" capture instruction, when the owner customised it. */
function fallbackNoteFromLinks(rawLinks: unknown): string | undefined {
  const routes = routesFromStoredLinks(parseRoutingLinks(rawLinks ?? null));
  const fallback = routes.find((r) => isFallbackRoute(r));
  return fallback?.note.trim() || undefined;
}

function hoursFieldsFromOrg(org: PromptOrgRow | null | undefined): Pick<
  CaraSetupPromptInput,
  | "openingHours"
  | "openingHoursSchedule"
  | "hoursNeverConfigured"
  | "open24_7"
  | "hoursNote"
> {
  const hoursUnset = isBusinessHoursUnset(org?.business_hours);
  if (hoursUnset) {
    return { hoursNeverConfigured: true };
  }

  const { schedule, meta } = parseBusinessHoursBundle(org?.business_hours);
  return {
    hoursNeverConfigured: false,
    open24_7: meta.open24_7 === true,
    hoursNote: meta.hoursNote?.trim() || undefined,
    openingHoursSchedule: schedule,
    openingHours:
      String(org?.agent_opening_hours ?? "").trim() ||
      formatWeekScheduleForAgent(schedule) ||
      undefined,
  };
}

export function buildCaraSetupPromptInputFromOrg(
  org: PromptOrgRow | null | undefined,
): CaraSetupPromptInput {
  const mode = parseCallRoutingMode(org?.call_routing_mode);
  const transfer = String(org?.fallback_number ?? "").trim();

  return {
    businessName: String(org?.name ?? "").trim(),
    assistantDisplayName: VOICE_ASSISTANT_DEFAULT_NAME,
    greeting: String(org?.greeting ?? "").trim() || undefined,
    businessType: String(org?.agent_business_type ?? "").trim(),
    locationAddress:
      String(org?.agent_location_address ?? "").trim() || undefined,
    locationEircode:
      String(org?.agent_location_eircode ?? "").trim() || undefined,
    ...hoursFieldsFromOrg(org),
    serviceArea: String(org?.agent_service_area ?? "").trim() || undefined,
    serviceAreaExclusions:
      String(org?.agent_service_area_exclusions ?? "").trim() || undefined,
    servicesOffered:
      String(org?.agent_services_departments ?? "").trim() || undefined,
    servicesNotOffered:
      String(org?.agent_services_not_offered ?? "").trim() || undefined,
    detailsToCollect:
      String(org?.agent_details_to_collect ?? "").trim() || undefined,
    businessRules: parseAgentBusinessRules(org?.agent_business_rules),
    faqs: parseAgentFaqs(org?.agent_faqs).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    routes: routingRoutesFromLinks(org?.routing_links),
    fallbackNote: fallbackNoteFromLinks(org?.routing_links),
    transferNumber: callRoutingAllowsHumanTransfer(mode) ? transfer : "",
  };
}

/** @deprecated Use buildCaraSetupPromptInputFromOrg — kept for callers expecting CaraCustomPromptInput shape. */
export function buildCustomPromptInputFromOrg(
  org: PromptOrgRow | null | undefined,
) {
  const input = buildCaraSetupPromptInputFromOrg(org);
  return {
    businessName: input.businessName,
    businessType: input.businessType,
    knowledgeSummary: input.anythingElse ?? "",
    openingHours: input.openingHours,
    serviceArea: input.serviceArea,
    servicesOffered: input.servicesOffered,
    servicesNotOffered: input.servicesNotOffered,
    detailsToCollect: input.detailsToCollect,
    businessRules: input.businessRules,
    faqs: input.faqs,
    routes: input.routes,
    fallbackNote: input.fallbackNote,
    transferNumber: input.transferNumber,
  };
}

/**
 * Recompile organizations.custom_prompt from structured setup fields. Safe to
 * call whenever knowledge, routes, the transfer number, or routing mode change.
 */
export async function regenerateCaraCustomPrompt(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: org, error: readError } = await supabase
    .from("organizations")
    .select(PROMPT_ORG_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle();

  if (readError) return { ok: false, message: readError.message };

  const businessFiles = await listBusinessFilesForOrg(
    supabase,
    organizationId,
  );
  const prompt = compileCaraPrompt({
    ...buildCaraSetupPromptInputFromOrg(org as PromptOrgRow | null),
    businessFiles,
  });

  const { error } = await supabase
    .from("organizations")
    .update({ custom_prompt: prompt, updated_at: new Date().toISOString() })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
