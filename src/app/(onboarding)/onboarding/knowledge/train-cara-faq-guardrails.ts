import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  detectCanonicalQuestion,
  findNearDuplicateFaqQuestion,
  type CanonicalQuestionCategory,
} from "@/lib/answers-boundary";
import { looksLikeOpeningHours } from "@/lib/call-handling-boundary";
import {
  weekScheduleHasOpenDay,
  emptyWeekSchedule,
  type WeekSchedule,
} from "@/lib/business-hours";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";

export type TrainCaraFaqGuardContext = {
  hasStructuredHours: boolean;
  hasStructuredLocation: boolean;
  hasStructuredServices: boolean;
  hasStructuredServiceArea: boolean;
};

const ONBOARDING_CANONICAL_MESSAGE: Record<CanonicalQuestionCategory, string> = {
  hours:
    "Cara already uses the opening hours from the Hours step — a separate FAQ here can give callers two different answers.",
  location:
    "Cara already knows your address from the Location step — use that instead of a duplicate FAQ.",
  services:
    "Cara already knows your services from the Services step — a separate FAQ here can conflict.",
  areas:
    "Cara already knows your service area from the Location step — use that instead of a duplicate FAQ.",
};

export function buildTrainCaraFaqGuardContext(input: {
  openingHoursSchedule: WeekSchedule;
  open24_7: boolean;
  hoursNeverConfigured: boolean;
  locationAddress: string;
  baseTown: string;
  locationCounty: string;
  locationEircode: string;
  serviceAreaItems: string[];
  servicesOffered: string;
  serviceCatalogCount: number;
}): TrainCaraFaqGuardContext {
  const hasStructuredHours =
    !input.hoursNeverConfigured &&
    (input.open24_7 || weekScheduleHasOpenDay(input.openingHoursSchedule));

  const hasStructuredLocation = Boolean(
    input.locationAddress.trim() ||
      input.baseTown.trim() ||
      input.locationCounty.trim() ||
      input.locationEircode.trim(),
  );

  const hasStructuredServices = Boolean(
    input.servicesOffered.trim() || input.serviceCatalogCount > 0,
  );

  const hasStructuredServiceArea = input.serviceAreaItems.some((item) =>
    item.trim(),
  );

  return {
    hasStructuredHours,
    hasStructuredLocation,
    hasStructuredServices,
    hasStructuredServiceArea,
  };
}

function structuredFieldCoversCategory(
  category: CanonicalQuestionCategory,
  context: TrainCaraFaqGuardContext,
): boolean {
  switch (category) {
    case "hours":
      return context.hasStructuredHours;
    case "location":
      return context.hasStructuredLocation;
    case "services":
      return context.hasStructuredServices;
    case "areas":
      return context.hasStructuredServiceArea;
    default:
      return false;
  }
}

export function onboardingCanonicalFaqWarning(
  question: string,
  context: TrainCaraFaqGuardContext,
): string | null {
  const match = detectCanonicalQuestion(question);
  if (!match) return null;
  if (!structuredFieldCoversCategory(match.category, context)) return null;
  return ONBOARDING_CANONICAL_MESSAGE[match.category];
}

export function faqConflictsWithStructuredHours(
  faq: AgentFaq,
  context: TrainCaraFaqGuardContext,
): boolean {
  if (!context.hasStructuredHours) return false;
  const combined = `${faq.question} ${faq.answer}`.trim();
  if (!combined) return false;
  if (onboardingCanonicalFaqWarning(faq.question, context)) return true;
  return looksLikeOpeningHours(combined);
}

export function lintOnboardingFaq(input: {
  faq: AgentFaq;
  index: number;
  faqs: AgentFaq[];
  context: TrainCaraFaqGuardContext;
}): { id: string; message: string; blockDone: boolean } | null {
  const canonical = onboardingCanonicalFaqWarning(
    input.faq.question,
    input.context,
  );
  if (canonical) {
    return { id: "canonical", message: canonical, blockDone: true };
  }

  if (faqConflictsWithStructuredHours(input.faq, input.context)) {
    return {
      id: "structured-hours",
      message:
        "This answer looks like opening hours. Cara already has those from the Hours step — change or remove this FAQ.",
      blockDone: true,
    };
  }

  const nearDup = findNearDuplicateFaqQuestion(
    input.faq.question,
    input.faqs,
    input.index,
  );
  if (nearDup) {
    return {
      id: "near-duplicate",
      message: `Very similar to "${nearDup.faq.question}" — keep one question so Cara gives a single answer.`,
      blockDone: true,
    };
  }

  return null;
}

export function dedupeOnboardingFaqs(faqs: AgentFaq[]): AgentFaq[] {
  const kept: AgentFaq[] = [];
  for (const faq of faqs) {
    if (!faq.question.trim() && !faq.answer.trim()) continue;
    if (findNearDuplicateFaqQuestion(faq.question, kept)) continue;
    kept.push(faq);
  }
  return kept;
}

export function filterConflictingOnboardingFaqs(
  faqs: AgentFaq[],
  context: TrainCaraFaqGuardContext,
): AgentFaq[] {
  return faqs.filter((faq) => {
    if (onboardingCanonicalFaqWarning(faq.question, context)) return false;
    if (faqConflictsWithStructuredHours(faq, context)) return false;
    return true;
  });
}

export function sanitizeOnboardingFaqs(
  faqs: AgentFaq[],
  context: TrainCaraFaqGuardContext,
): AgentFaq[] {
  return dedupeOnboardingFaqs(filterConflictingOnboardingFaqs(faqs, context));
}

export function buildTrainCaraFaqGuardContextFromPayload(payload: {
  businessHours?: WeekSchedule;
  open24_7?: boolean;
  openingHours?: string;
  locationAddress?: string;
  baseTown?: string;
  locationCounty?: string;
  locationEircode?: string;
  serviceArea?: string;
  servicesOffered?: string;
  serviceCatalogCount?: number;
}): TrainCaraFaqGuardContext {
  const schedule = payload.businessHours ?? emptyWeekSchedule();
  const hoursText = String(payload.openingHours ?? "").trim();
  const hasHours =
    payload.open24_7 === true ||
    weekScheduleHasOpenDay(schedule) ||
    Boolean(hoursText);

  return buildTrainCaraFaqGuardContext({
    openingHoursSchedule: schedule,
    open24_7: payload.open24_7 === true,
    hoursNeverConfigured: !hasHours,
    locationAddress: String(payload.locationAddress ?? ""),
    baseTown: String(payload.baseTown ?? ""),
    locationCounty: String(payload.locationCounty ?? ""),
    locationEircode: String(payload.locationEircode ?? ""),
    serviceAreaItems: parseAgentKnowledgeList(String(payload.serviceArea ?? "")),
    servicesOffered: String(payload.servicesOffered ?? ""),
    serviceCatalogCount: payload.serviceCatalogCount ?? 0,
  });
}
