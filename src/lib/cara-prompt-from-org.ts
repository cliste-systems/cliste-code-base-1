import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { listBusinessFilesForOrg } from "@/lib/business-files-server";
import {
  inferBookingFulfilmentMethod,
} from "@/app/(dashboard)/dashboard/routing/booking-fulfilment";
import {
  isFallbackRoute,
  routeKeywords,
  routesFromStoredLinks,
  type RouteOutcomeKind,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import { parseAgentCaraRules } from "@/lib/agent-cara-rules";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import {
  emptyWeekSchedule,
  isBusinessHoursUnset,
  parseBusinessHoursBundle,
} from "@/lib/business-hours";
import { recoverHoursNoteFromSources } from "@/lib/parse-plain-text-hours";
import { parseCaraConduct } from "@/lib/agent-cara-conduct";
import {
  compileCaraPromptWithMeta,
  type CaraCompileMeta,
  type CaraSetupPromptInput,
} from "@/lib/compile-cara-prompt";
import { verticalPackForNiche } from "@/lib/verticals";
import {
  assistantNameLabel,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";
import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
} from "@/lib/call-routing";

import { parseDetailsCollectMode } from "@/lib/details-collect-mode";
import { parseStoredLocation } from "@/lib/location-fields";
import { listServicesForOrg } from "@/lib/service-catalog";
import { parseStoredServiceCatalogSupplement } from "@/lib/service-catalog-supplement";

const PROMPT_ORG_COLUMNS =
  "name, assistant_display_name, greeting, agent_business_type, business_knowledge_summary, agent_opening_hours, business_hours, agent_service_area, agent_service_area_exclusions, agent_base_town, agent_services_departments, agent_services_not_offered, agent_service_catalog_supplement, agent_details_to_collect, agent_details_collect_mode, agent_business_rules, agent_cara_rules, agent_cara_conduct, agent_faqs, agent_location_address, agent_location_eircode, agent_location_county, routing_links, fallback_number, call_routing_mode, quote_prices_on_calls, niche";

export type PromptCompileWarnings = CaraCompileMeta & {
  trimmedAt: string;
};

type PromptOrgRow = Record<string, unknown>;

/** What Cara should do for each saved route, phrased for the call prompt. */
function actionPhraseForRoute(
  route: Pick<SavedRoute, "templateId" | "outcome" | "linkDelivery" | "description">,
): string {
  if (route.templateId === "location") {
    const delivery = route.linkDelivery ?? "sms";
    if (delivery === "email") {
      return "tell them the address, then ask if they want it emailed and send the maps link to their email";
    }
    if (delivery === "both") {
      return "tell them the address, then ask if they want the maps link by text or email and send it their way";
    }
    return "tell them the address, then ask if they want the maps link texted to their mobile";
  }
  if (route.templateId === "booking-inquiry") {
    const method = inferBookingFulfilmentMethod(route);
    if (method === "callback") {
      return "take their booking details for a team callback — this is a request, not a confirmed appointment";
    }
    const delivery = route.linkDelivery ?? "sms";
    const linkPhrase =
      delivery === "email"
        ? "offer the booking link and email it when they want it"
        : delivery === "both"
          ? "offer the booking link and ask if they want it by text or email"
          : "offer the booking link and text it to their mobile when they want it";
    if (method === "both") {
      return `${linkPhrase}, and also capture backup booking details for Action Inbox`;
    }
    return linkPhrase;
  }
  return actionPhraseForOutcome(route.outcome);
}

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
      action: actionPhraseForRoute(r),
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
  | "bankHolidays"
> {
  const legacyHours = String(org?.agent_opening_hours ?? "").trim();
  const hoursUnset = isBusinessHoursUnset(org?.business_hours);
  if (hoursUnset) {
    if (legacyHours) {
      return {
        hoursNeverConfigured: false,
        openingHours: legacyHours,
        openingHoursSchedule: emptyWeekSchedule(),
      };
    }
    return { hoursNeverConfigured: true };
  }

  const { schedule, meta } = parseBusinessHoursBundle(org?.business_hours);
  const businessRules = parseAgentBusinessRules(org?.agent_business_rules);
  const hoursNote = recoverHoursNoteFromSources(
    meta.hoursNote,
    legacyHours,
    businessRules,
  );
  return {
    hoursNeverConfigured: false,
    open24_7: meta.open24_7 === true,
    hoursNote: hoursNote || undefined,
    bankHolidays: meta.bankHolidays,
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

  const niche = String(org?.niche ?? "").trim();
  const pack = verticalPackForNiche(niche);

  return {
    businessName: String(org?.name ?? "").trim(),
    niche: niche || undefined,
    assistantDisplayName:
      assistantNameLabel(
        String(org?.assistant_display_name ?? "").trim() ||
          VOICE_ASSISTANT_DEFAULT_NAME,
      ),
    greeting: String(org?.greeting ?? "").trim() || undefined,
    businessType: String(org?.agent_business_type ?? "").trim(),
    ...(() => {
      const loc = parseStoredLocation({
        address: String(org?.agent_location_address ?? ""),
        baseTown: String(org?.agent_base_town ?? ""),
        county: String(org?.agent_location_county ?? ""),
      });
      return {
        locationAddress: loc.street || undefined,
        baseTown: loc.town || undefined,
        locationCounty: loc.county || undefined,
      };
    })(),
    locationEircode:
      String(org?.agent_location_eircode ?? "").trim() || undefined,
    ...hoursFieldsFromOrg(org),
    serviceArea: pack.capabilities.skipServiceArea
      ? undefined
      : String(org?.agent_service_area ?? "").trim() || undefined,
    serviceAreaExclusions:
      String(org?.agent_service_area_exclusions ?? "").trim() || undefined,
    servicesOffered:
      String(org?.agent_services_departments ?? "").trim() || undefined,
    servicesNotOffered:
      String(org?.agent_services_not_offered ?? "").trim() || undefined,
    detailsToCollect:
      String(org?.agent_details_to_collect ?? "").trim() || undefined,
    detailsCollectMode: parseDetailsCollectMode(org?.agent_details_collect_mode),
    businessRules: parseAgentBusinessRules(org?.agent_business_rules),
    caraRules: parseAgentCaraRules(org?.agent_cara_rules),
    caraConduct: parseCaraConduct(org?.agent_cara_conduct),
    quotePricesOnCalls: org?.quote_prices_on_calls === true,
    faqs: parseAgentFaqs(org?.agent_faqs).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    routes: routingRoutesFromLinks(org?.routing_links),
    fallbackNote: fallbackNoteFromLinks(org?.routing_links),
    transferNumber: callRoutingAllowsHumanTransfer(mode) ? transfer : "",
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

  const niche = String((org as PromptOrgRow | null)?.niche ?? "");
  const useCatalog = verticalPackForNiche(niche).capabilities.usesServiceCatalog;
  const serviceCatalog = useCatalog
    ? await listServicesForOrg(supabase, organizationId)
    : [];
  const serviceCatalogSupplement = parseStoredServiceCatalogSupplement(
    (org as PromptOrgRow | null)?.agent_service_catalog_supplement,
  );

  const { prompt, compileMeta } = compileCaraPromptWithMeta({
    ...buildCaraSetupPromptInputFromOrg(org as PromptOrgRow | null),
    businessFiles,
    serviceCatalog: serviceCatalog.length > 0 ? serviceCatalog : undefined,
    serviceCatalogSupplement: serviceCatalogSupplement ?? undefined,
  });

  const promptCompileWarnings: PromptCompileWarnings | null = compileMeta.wasTrimmed
    ? { ...compileMeta, trimmedAt: new Date().toISOString() }
    : null;

  const { error } = await supabase
    .from("organizations")
    .update({
      custom_prompt: prompt,
      prompt_compile_warnings: promptCompileWarnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
