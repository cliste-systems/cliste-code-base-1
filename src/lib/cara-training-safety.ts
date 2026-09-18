import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  cleanAgentFaqs,
} from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  isFallbackRoute,
  routeKeywords,
  routesFromStoredLinks,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import { listBusinessFilesForOrg } from "@/lib/business-files-server";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import {
  snapshotFromLists,
  type CaraKnowledgeSnapshot,
} from "@/lib/cara-knowledge-snapshot";
import {
  assessTrainingPatchSafety,
  formatTrainingSafetyBlockMessage,
  lintTrainingFaqDuplicateIssues,
  type TrainingSafetyIssue,
} from "@/lib/cara-training-safety-eval";
import type { CaraTrainingPatch } from "@/lib/cara-training-types";
import { listServicesForOrg } from "@/lib/service-catalog";
import { verticalPackForNiche } from "@/lib/verticals";

export type { TrainingSafetyIssue };
export {
  assessTrainingPatchSafety,
  formatTrainingSafetyBlockMessage,
  lintTrainingFaqDuplicateIssues,
};

function actionPhraseForRoute(route: SavedRoute): string {
  switch (route.outcome) {
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

function routingSummariesFromLinks(rawLinks: unknown): RoutingActionSummary[] {
  const routes = routesFromStoredLinks(parseRoutingLinks(rawLinks ?? null));
  return routes
    .filter((route) => route.active && !isFallbackRoute(route) && routeKeywords(route))
    .map((route) => ({
      trigger: routeKeywords(route),
      action: actionPhraseForRoute(route),
      instruction: route.description?.trim() || undefined,
    }));
}

export async function loadOrgKnowledgeSnapshotForSafety(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CaraKnowledgeSnapshot> {
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "niche, agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules, agent_opening_hours, agent_service_area, routing_links, fallback_number",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const niche = String(org?.niche ?? "");
  const useCatalog = verticalPackForNiche(niche).capabilities.usesServiceCatalog;
  const [businessFiles, serviceCatalog] = await Promise.all([
    listBusinessFilesForOrg(supabase, organizationId),
    useCatalog ? listServicesForOrg(supabase, organizationId) : Promise.resolve([]),
  ]);

  return snapshotFromLists({
    openingHours: String(org?.agent_opening_hours ?? "").trim() || undefined,
    serviceArea: String(org?.agent_service_area ?? "").trim() || undefined,
    servicesOffered: String(org?.agent_services_departments ?? "").trim() || undefined,
    servicesNotOffered: String(org?.agent_services_not_offered ?? "").trim() || undefined,
    businessRules: parseAgentBusinessRules(org?.agent_business_rules),
    faqs: cleanAgentFaqs(org?.agent_faqs),
    routingSummaries: routingSummariesFromLinks(org?.routing_links),
    transferNumber: String(org?.fallback_number ?? "").trim() || undefined,
    serviceCatalog: serviceCatalog.length > 0 ? serviceCatalog : undefined,
    businessFiles,
    niche,
  });
}

export async function assessTrainingPatchSafetyForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  patch: CaraTrainingPatch,
): Promise<{ ok: true } | { ok: false; issues: TrainingSafetyIssue[] }> {
  const snapshot = await loadOrgKnowledgeSnapshotForSafety(
    supabase,
    organizationId,
  );
  return assessTrainingPatchSafety({ patch, snapshot });
}
