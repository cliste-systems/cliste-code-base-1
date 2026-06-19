import {
  parseBusinessHoursBundle,
  weekScheduleHasOpenDay,
} from "@/lib/business-hours";
import { NEVER_QUOTE_PRICE_PATTERN } from "@/lib/call-handling-boundary";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { ONBOARDING_STEPS } from "@/lib/onboarding-session";
import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  isCustomRoute,
  routesFromStoredLinks,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import { verticalPackForNiche } from "@/lib/verticals";

export type GoLiveChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  href: string;
};

export type GoLiveChecklistInput = {
  businessHours: unknown;
  agentOpeningHours: string | null;
  routingLinks: unknown;
  agentBusinessRules: unknown;
  agentFaqs: unknown;
  onboardingStep: number;
  hasCallLog: boolean;
  niche?: string | null;
  caraHandleOptions?: string[] | null;
  bookingLinkLabel?: string;
  enquiryLinkLabel?: string;
};

const PRICING_FAQ_PATTERN = /price|pricing|how much|cost/i;

function parseFaqs(raw: unknown): { question: string; answer: string }[] {
  return parseAgentFaqs(raw).map((faq) => ({
    question: faq.question.trim(),
    answer: faq.answer.trim(),
  }));
}

function hasSalonBookingLinkRoute(routingLinks: unknown): boolean {
  const routes = routesFromStoredLinks(parseRoutingLinks(routingLinks));
  return routes.some(
    (route) =>
      route.templateId === "booking-inquiry" &&
      route.active &&
      route.url.trim().length > 0,
  );
}

function hasEnquiryLinkRoute(routingLinks: unknown): boolean {
  const routes = routesFromStoredLinks(parseRoutingLinks(routingLinks));
  return routes.some(
    (route) =>
      route.outcome === "send_link" &&
      isCustomRoute(route) &&
      route.active &&
      route.url.trim().length > 0,
  );
}

function hasNeverQuoteRule(rules: string[]): boolean {
  return rules.some((rule) => NEVER_QUOTE_PRICE_PATTERN.test(rule));
}

function hasPricingFaq(faqs: { question: string; answer: string }[]): boolean {
  return faqs.some((faq) =>
    PRICING_FAQ_PATTERN.test(`${faq.question} ${faq.answer}`),
  );
}

function includesSendLinkCapability(
  caraHandleOptions: string[] | null | undefined,
): boolean {
  return (caraHandleOptions ?? []).includes("send_link");
}

function shouldIncludeLinkChecklistItem(
  niche: string | null | undefined,
  caraHandleOptions: string[] | null | undefined,
): boolean {
  const pack = verticalPackForNiche(niche);
  if (pack.capabilities.alwaysIncludeLinkChecklist) return true;
  return includesSendLinkCapability(caraHandleOptions);
}

export function buildGoLiveChecklist(
  input: GoLiveChecklistInput,
): GoLiveChecklistItem[] {
  const schedule = parseBusinessHoursBundle(input.businessHours).schedule;
  const legacyHours = String(input.agentOpeningHours ?? "").trim();
  const hoursComplete =
    weekScheduleHasOpenDay(schedule) || legacyHours.length > 0;

  const rules = parseAgentBusinessRules(input.agentBusinessRules);
  const faqs = parseFaqs(input.agentFaqs);
  const pricingComplete = hasPricingFaq(faqs) || !hasNeverQuoteRule(rules);

  const testCallComplete =
    input.hasCallLog || input.onboardingStep >= ONBOARDING_STEPS.goLive;

  const pack = verticalPackForNiche(input.niche);
  const usesBookingInquiryRoute =
    pack.capabilities.linkChecklistUsesBookingInquiryRoute;
  const items: GoLiveChecklistItem[] = [
    {
      id: "opening-hours",
      label: "Opening hours",
      complete: hoursComplete,
      href: DASHBOARD_ROUTES.businessProfile,
    },
  ];

  if (shouldIncludeLinkChecklistItem(input.niche, input.caraHandleOptions)) {
    items.push({
      id: "booking-link",
      label: usesBookingInquiryRoute
        ? (input.bookingLinkLabel ?? "Booking link")
        : (input.enquiryLinkLabel ?? "Scheduling or enquiry link"),
      complete: usesBookingInquiryRoute
        ? hasSalonBookingLinkRoute(input.routingLinks)
        : hasEnquiryLinkRoute(input.routingLinks),
      href: DASHBOARD_ROUTES.routing,
    });
  }

  items.push(
    {
      id: "test-call",
      label: "Test call",
      complete: testCallComplete,
      href: DASHBOARD_ROUTES.settings,
    },
    {
      id: "pricing-faq",
      label: "Pricing guidance",
      complete: pricingComplete,
      href: DASHBOARD_ROUTES.businessFaqs,
    },
  );

  return items;
}

export function goLiveChecklistAllComplete(items: GoLiveChecklistItem[]): boolean {
  return items.length > 0 && items.every((item) => item.complete);
}
