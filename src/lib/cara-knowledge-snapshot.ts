import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import type { SavedRoute } from "@/app/(dashboard)/dashboard/routing/route-models";
import type { CaraCaptureField } from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import type { CaraGoal } from "@/lib/cara-goal";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import type { BusinessFileListItem } from "@/lib/business-files";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import type { ServiceCatalogSupplement } from "@/lib/service-catalog-supplement";

export type CaraKnowledgeSnapshot = {
  about?: string;
  openingHours?: string;
  openingHoursLegacy?: string;
  hoursNeverConfigured?: boolean;
  open24_7?: boolean;
  serviceArea?: string;
  servicesOffered?: string[];
  servicesOfferedRaw?: string;
  servicesNotOffered?: string[];
  servicesNotOfferedRaw?: string;
  businessRules?: string[];
  rulesRaw?: string;
  captureFields?: CaraCaptureField[];
  detailsToCollect?: string[];
  faqs?: AgentFaq[];
  anythingElse?: string;
  routes?: SavedRoute[];
  routingSummaries?: RoutingActionSummary[];
  transferNumber?: string;
  serviceCatalog?: ServiceCatalogItem[];
  serviceCatalogSupplement?: ServiceCatalogSupplement;
  businessFiles?: BusinessFileListItem[];
  caraGoal?: CaraGoal;
  niche?: string;
};

export function listFromKnowledgeText(text: string | undefined): string[] {
  return parseAgentKnowledgeList(String(text ?? "").trim());
}

export function snapshotFromLists(input: {
  about?: string;
  openingHours?: string;
  openingHoursLegacy?: string;
  hoursNeverConfigured?: boolean;
  open24_7?: boolean;
  serviceArea?: string;
  servicesOffered?: string;
  servicesOfferedRaw?: string;
  servicesNotOffered?: string;
  servicesNotOfferedRaw?: string;
  businessRules?: string[];
  rulesRaw?: string;
  captureFields?: CaraCaptureField[];
  detailsToCollect?: string;
  faqs?: AgentFaq[];
  anythingElse?: string;
  routes?: SavedRoute[];
  routingSummaries?: RoutingActionSummary[];
  transferNumber?: string;
  serviceCatalog?: ServiceCatalogItem[];
  serviceCatalogSupplement?: ServiceCatalogSupplement;
  businessFiles?: BusinessFileListItem[];
  caraGoal?: CaraGoal;
  niche?: string;
}): CaraKnowledgeSnapshot {
  return {
    about: input.about?.trim() || undefined,
    openingHours: input.openingHours?.trim() || undefined,
    openingHoursLegacy: input.openingHoursLegacy?.trim() || undefined,
    hoursNeverConfigured: input.hoursNeverConfigured,
    open24_7: input.open24_7,
    serviceArea: input.serviceArea?.trim() || undefined,
    servicesOffered: listFromKnowledgeText(input.servicesOffered),
    servicesOfferedRaw: input.servicesOfferedRaw?.trim() || undefined,
    servicesNotOffered: listFromKnowledgeText(input.servicesNotOffered),
    servicesNotOfferedRaw: input.servicesNotOfferedRaw?.trim() || undefined,
    businessRules: input.businessRules ?? [],
    rulesRaw: input.rulesRaw?.trim() || undefined,
    captureFields: input.captureFields,
    detailsToCollect: listFromKnowledgeText(input.detailsToCollect),
    faqs: input.faqs ?? [],
    anythingElse: input.anythingElse?.trim() || undefined,
    routes: input.routes,
    routingSummaries: input.routingSummaries,
    transferNumber: input.transferNumber?.trim() || undefined,
    serviceCatalog: input.serviceCatalog,
    serviceCatalogSupplement: input.serviceCatalogSupplement,
    businessFiles: input.businessFiles,
    caraGoal: input.caraGoal,
    niche: input.niche,
  };
}
