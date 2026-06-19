/**
 * Score generic-vertical onboarding personas (trades, hospitality, other, events)
 * without browser automation — mirrors the Luna Lantern E2E simulation.
 *
 *   npx tsx scripts/simulate-generic-niche-scorecard.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { compileCaraPrompt } from "../src/lib/compile-cara-prompt";
import { parseAgentBusinessRules } from "../src/lib/agent-business-rules";
import { parseAgentFaqs } from "../src/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  parseBusinessHoursBundle,
  serializeBusinessHours,
  weekScheduleHasOpenDay,
} from "../src/lib/business-hours";
import { dashboardVerticalCopy } from "../src/lib/dashboard-vertical-copy";
import { parsePlainTextOpeningHours } from "../src/lib/parse-plain-text-hours";
import { verticalPackForNiche } from "../src/lib/verticals";
import { deterministicFaqSuggestions } from "../src/app/(onboarding)/onboarding/knowledge/train-cara-prefill-heuristics";
import { resolveFaqSuggestions } from "../src/app/(onboarding)/onboarding/knowledge/train-cara-faq-suggestions";
import { packServicesStepCopy } from "../src/app/(onboarding)/onboarding/knowledge/train-cara-services-copy";
import { trainCaraVerticalCopy } from "../src/app/(onboarding)/onboarding/knowledge/train-cara-vertical-copy";
import {
  tradePackForNicheAndType,
} from "../src/app/(onboarding)/onboarding/knowledge/train-cara-trade-topics";

const ONBOARDING_STEP_GO_LIVE = 6;

const NEVER_QUOTE_PRICE_PATTERN =
  /\b(?:never|don'?t|do not)\b[^.]{0,40}\b(?:quote|give|discuss|mention)\b[^.]{0,30}\bpric/i;
const PRICING_FAQ_PATTERN = /price|pricing|how much|cost/i;

function buildChecklist(input: {
  businessHours: unknown;
  agentOpeningHours: string;
  routingLinks: unknown[];
  agentBusinessRules: string[];
  agentFaqs: { question: string; answer: string }[];
  onboardingStep: number;
  hasCallLog: boolean;
  niche: string;
  caraHandleOptions: string[];
  enquiryLinkLabel?: string;
}) {
  const schedule = parseBusinessHoursBundle(input.businessHours).schedule;
  const hoursComplete =
    weekScheduleHasOpenDay(schedule) || input.agentOpeningHours.trim().length > 0;
  const pricingComplete =
    input.agentFaqs.some((faq) =>
      PRICING_FAQ_PATTERN.test(`${faq.question} ${faq.answer}`),
    ) ||
    !input.agentBusinessRules.some((rule) =>
      NEVER_QUOTE_PRICE_PATTERN.test(rule),
    );
  const testCallComplete =
    input.hasCallLog || input.onboardingStep >= ONBOARDING_STEP_GO_LIVE;
  const pack = verticalPackForNiche(input.niche);
  const wantsLink =
    pack.capabilities.alwaysIncludeLinkChecklist ||
    input.caraHandleOptions.includes("send_link");

  const items: { id: string; label: string; complete: boolean }[] = [
    { id: "opening-hours", label: "Opening hours", complete: hoursComplete },
  ];

  if (wantsLink) {
    const hasUrl = input.routingLinks.some(
      (link) =>
        typeof link === "object" &&
        link !== null &&
        "url" in link &&
        String((link as { url?: string }).url ?? "").trim().length > 0,
    );
    items.push({
      id: "booking-link",
      label: pack.capabilities.linkChecklistUsesBookingInquiryRoute
        ? "Booking link"
        : (input.enquiryLinkLabel ?? "Scheduling or enquiry link"),
      complete: hasUrl,
    });
  }

  items.push(
    { id: "test-call", label: "Test call", complete: testCallComplete },
    { id: "pricing-faq", label: "Pricing guidance", complete: pricingComplete },
  );

  return items;
}

/** Offline niche classifier (mirrors classify-business-description heuristics). */
function heuristicNiche(lower: string): string {
  if (/\b(barber|barbershop|barber shop|barbers)\b/i.test(lower)) return "barber";
  if (
    /\b(hairdresser|hairdressers|hair salon|hair stylist|hairstylist|hair and beauty)\b/i.test(
      lower,
    ) ||
    (/\bsalon\b/i.test(lower) && !/\b(tanning|sun|nail|beauty)\b/i.test(lower))
  ) {
    return "hair_salon";
  }
  if (
    /\b(nail|nails|beauty salon|beautician|spa|lash|brow|wax|tanning|aesthetic|makeup|make-up|skincare|facial)\b/i.test(
      lower,
    )
  ) {
    return "beauty";
  }
  if (
    /\b(plumb|electric|heating|boiler|hvac|carpenter|carpentry|joiner|builder|construction|roofer|roofing|plaster|tiler|tiling|painter|painting|decorator|handyman|kitchen fitter|bathroom fitter|landscap|fencing|groundwork|scaffold|welder|glazier|drainage)\b/i.test(
      lower,
    )
  ) {
    return "trades";
  }
  if (
    /\b(cleaning|cleaner|window clean|gardening|gardener|pest control|locksmith|removal|man with a van|chimney|gutter|driveway|pressure wash|waste|skip hire)\b/i.test(
      lower,
    )
  ) {
    return "home_services";
  }
  if (
    /\b(restaurant|cafe|caf\u00e9|coffee|takeaway|take away|deli|pub|bar|bistro|catering|caterer|food truck|bakery|patisserie|chipper|pizzeria|hotel|guesthouse|b&b)\b/i.test(
      lower,
    )
  ) {
    return "hospitality";
  }
  if (
    /\b(wedding|event|events|photographer|photography|videographer|dj|disco|venue|entertain|party|marquee|florist hire)\b/i.test(
      lower,
    )
  ) {
    return "events";
  }
  if (
    /\b(tutor|tuition|school|academy|driving instructor|driving school|training|lessons|grind|montessori|creche|cr\u00e8che|childcare|education)\b/i.test(
      lower,
    )
  ) {
    return "education";
  }
  return "other";
}

type Persona = {
  id: string;
  businessName: string;
  description: string;
  expectedNiche: string;
  businessType: string;
  about: string;
  services: string;
  hours: string;
  serviceArea: string;
  details: string;
  rules: string;
  faqs: { question: string; answer: string }[];
  enquiryLink?: string;
};

const PERSONAS: Persona[] = [
  {
    id: "trades",
    businessName: "Murphy's Plumbing & Heating",
    description:
      "Emergency plumber and heating engineer covering Dublin and Wicklow — boilers, leaks, burst pipes, radiator repairs",
    expectedNiche: "trades",
    businessType: "Plumbing and heating",
    about:
      "Family-run plumbing and heating business — emergency callouts, boiler service, leaks, and radiator repairs across Dublin and Wicklow.",
    services:
      "Emergency plumbing, boiler service and repair, burst pipes, radiator installs, heating diagnostics",
    hours: "Mon–Fri 8am–6pm. Emergency callouts 24/7.",
    serviceArea: "Dublin city, south Dublin, and Wicklow",
    details: "Name, phone, address, what's wrong, and whether it's an emergency",
    rules: "Never quote over the phone without a brief description of the issue.",
    faqs: [
      {
        question: "Do you offer emergency callouts?",
        answer: "Yes — 24/7 for burst pipes, no heating, and major leaks.",
      },
      {
        question: "What areas do you cover?",
        answer: "Dublin city, south Dublin, and most of Wicklow.",
      },
      {
        question: "How much does a callout cost?",
        answer: "Emergency callouts from €120 — we confirm before dispatch when possible.",
      },
    ],
    enquiryLink: "https://murphyplumbing.example/contact",
  },
  {
    id: "hospitality",
    businessName: "The Copper Kettle Café",
    description:
      "Independent café on Main Street — breakfast, lunch, speciality coffee, weekend brunch, takeaway",
    expectedNiche: "hospitality",
    businessType: "Café",
    about:
      "Neighbourhood café serving breakfast, lunch, and speciality coffee — weekend brunch and takeaway too.",
    services:
      "Breakfast, lunch, speciality coffee, weekend brunch, cakes, takeaway",
    hours: "Tue–Sun 8am–4pm. Closed Mondays.",
    serviceArea: "Naas town centre",
    details: "Name, phone, party size, and preferred time for table bookings",
    rules: "Don't promise tables without checking — take a callback number for groups over 6.",
    faqs: [
      {
        question: "Are you open on weekends?",
        answer: "Yes — Sat and Sun 8am–4pm with brunch until 2pm.",
      },
      {
        question: "Do you take reservations?",
        answer: "Walk-ins welcome; we take bookings for groups of 4 or more.",
      },
      {
        question: "Do you do takeaway?",
        answer: "Yes — coffee and lunch menu available to go.",
      },
    ],
  },
  {
    id: "other",
    businessName: "BrightPath Solutions",
    description:
      "We help local businesses stay on top of admin and customer enquiries",
    expectedNiche: "other",
    businessType: "Business support",
    about:
      "BrightPath helps small businesses with admin, inbox triage, and customer follow-up — flexible support without hiring full-time.",
    services: "Inbox triage, appointment scheduling, customer callbacks, light admin",
    hours: "Mon–Fri 9am–5pm. Closed weekends.",
    serviceArea: "Remote — clients across Ireland",
    details: "Name, company, what they need help with, and best callback time",
    rules: "Never discuss specific client accounts — take a message and callback details.",
    faqs: [
      {
        question: "How do I get started?",
        answer: "Book a 20-minute intro call — we'll outline options after that.",
      },
      {
        question: "What does it cost?",
        answer: "Packages from €250/month depending on hours needed.",
      },
      {
        question: "Can you cover evenings?",
        answer: "Standard hours are weekdays; evening cover by arrangement.",
      },
    ],
  },
  {
    id: "events",
    businessName: "Luna Lantern Events",
    description:
      "Wedding and corporate event planning — lighting, staging, and on-the-day coordination across Leinster",
    expectedNiche: "events",
    businessType: "Wedding and corporate event planning",
    about:
      "Luna Lantern Events plans weddings and corporate events across Leinster — lighting, staging, and on-the-day coordination.",
    services:
      "Event lighting hire, staging, AV setup, wedding coordination, corporate launches",
    hours: "Thu–Sat 10am–10pm. Mon–Wed by appointment only. Closed public holidays.",
    serviceArea: "Dublin, Wicklow, Kildare, and Meath",
    details: "Name, phone, event date, venue, guest count, and what they need",
    rules: "Never quote full packages without a site visit.",
    faqs: [
      {
        question: "How far in advance should we book?",
        answer: "Weddings ideally 6–12 months ahead; corporate events 4–8 weeks.",
      },
      {
        question: "Do you work outdoor venues?",
        answer: "Yes — site visit needed for power and rigging.",
      },
      {
        question: "How much does lighting hire cost?",
        answer: "From €800 depending on venue size — we quote after a quick chat.",
      },
    ],
    enquiryLink: "https://lunalantern.example/enquire",
  },
];

const SALON_BLEED =
  /\b(salon|stylist|walk-?in|colour|balayage|booksy|fresha|salon calls)\b/i;

function scoreBand(score: number): string {
  if (score >= 4.5) return "excellent";
  if (score >= 3.5) return "good";
  if (score >= 2.5) return "fair";
  return "poor";
}

function ratePersona(persona: Persona) {
  const classifiedNiche = heuristicNiche(persona.description.toLowerCase());
  const niche = classifiedNiche;
  const vertical = verticalPackForNiche(niche).id;
  const tradePack = tradePackForNicheAndType(niche, persona.businessType);
  const trainCopy = trainCaraVerticalCopy(niche);
  const dashCopy = dashboardVerticalCopy(niche, persona.businessType);

  const faqContext = {
    businessType: persona.businessType,
    niche,
    about: persona.about,
    servicesOffered: persona.services,
    serviceArea: persona.serviceArea,
    openingHours: persona.hours,
    servicesNotOffered: "",
  };

  const faqChips = resolveFaqSuggestions({
    businessType: persona.businessType,
    niche,
    context: faqContext,
  });
  const detFaqs = deterministicFaqSuggestions(faqContext);
  const servicesCopy = packServicesStepCopy(persona.businessType, niche);

  const parsedHours = parsePlainTextOpeningHours(persona.hours);
  const businessHours = parsedHours
    ? serializeBusinessHours(parsedHours.schedule, {
        hoursNote: parsedHours.hoursNote,
      })
    : null;
  const hoursHasOpen =
    parsedHours !== null && weekScheduleHasOpenDay(parsedHours.schedule);
  const appointmentDaysOpen =
    persona.hours.includes("appointment") && parsedHours
      ? ["monday", "tuesday", "wednesday"].every(
          (d) =>
            parsedHours.schedule[d as keyof typeof parsedHours.schedule]?.open,
        )
      : true;

  const routingLinks = persona.enquiryLink
    ? [
        {
          id: "form-application",
          templateId: "form-application",
          outcome: "send_link",
          active: true,
          url: persona.enquiryLink,
          keywords: "enquiry, website, contact",
          name: "Website or enquiry",
        },
      ]
    : [];

  const caraHandleOptions = persona.enquiryLink ? ["send_link"] : [];

  const checklistNoLink = buildChecklist({
    businessHours,
    agentOpeningHours: persona.hours,
    routingLinks: [],
    agentBusinessRules: [persona.rules],
    agentFaqs: persona.faqs,
    onboardingStep: 6,
    hasCallLog: false,
    niche,
    caraHandleOptions: [],
  });

  const checklistWithLink = buildChecklist({
    businessHours,
    agentOpeningHours: persona.hours,
    routingLinks,
    agentBusinessRules: [persona.rules],
    agentFaqs: persona.faqs,
    onboardingStep: 6,
    hasCallLog: false,
    niche,
    caraHandleOptions,
    enquiryLinkLabel: dashCopy.routing.goLiveEnquiryLinkLabel,
  });

  const { schedule } = parseBusinessHoursBundle(businessHours);
  const prompt = compileCaraPrompt({
    businessName: persona.businessName,
    assistantDisplayName: "Cara",
    greeting: `Hi, you've reached ${persona.businessName}. This is Cara. How can I help you today?`,
    businessType: persona.businessType,
    locationAddress: "Dublin",
    locationEircode: "D01",
    hoursNeverConfigured: false,
    openingHoursSchedule: schedule,
    openingHours: persona.hours,
    serviceArea: persona.serviceArea,
    servicesOffered: persona.services,
    detailsToCollect: persona.details,
    businessRules: parseAgentBusinessRules([persona.rules]),
    faqs: parseAgentFaqs(persona.faqs),
    routes: [],
    transferNumber: "",
    businessFiles: [],
  });

  const salonBleedInPrompt = SALON_BLEED.test(prompt);
  const salonBleedInCopy =
    SALON_BLEED.test(trainCopy.about.title) ||
    SALON_BLEED.test(trainCopy.faqs.title) ||
    SALON_BLEED.test(dashCopy.home.goLiveChecklistSuffix);
  const closedEveryDay = /closed every day/i.test(prompt);
  const tradesChipOnEvents =
    persona.id === "events" &&
    faqChips.some((q) => /come out/i.test(q));
  const wrongNiche = classifiedNiche !== persona.expectedNiche;

  const scores = {
    classification: wrongNiche ? 3 : 5,
    trainCaraCopy: trainCopy.about.title.includes("salon") ? 1 : 5,
    faqChips:
      tradesChipOnEvents || (persona.id === "other" && faqChips.length < 2)
        ? 3
        : persona.id === "hospitality" &&
            !faqChips.some((q) => /reserv|table|takeaway|brunch/i.test(q))
          ? 3
          : persona.id === "trades" &&
              faqChips.some((q) => /emergency|callout|cover/i.test(q))
            ? 5
            : persona.id === "events" &&
                faqChips.some((q) => /book|venue|lighting|advance/i.test(q))
              ? 5
              : 4,
    hoursSync:
      !hoursHasOpen ? 2 : persona.hours.includes("appointment") && !appointmentDaysOpen ? 2 : 5,
    checklist:
      checklistNoLink.some((i) => i.id === "booking-link")
        ? 2
        : checklistNoLink.every((i) => i.complete || i.id === "test-call")
          ? 5
          : 4,
    checklistWithEnquiryLink:
      persona.enquiryLink && checklistWithLink.every((i) => i.complete)
        ? 5
        : persona.enquiryLink
          ? 3
          : null,
    promptQuality: salonBleedInPrompt || closedEveryDay ? 2 : 5,
    servicesStepCopy: servicesCopy.subtitle.includes("salon") ? 1 : 4,
  };

  const overall =
    Object.values(scores).filter((v) => typeof v === "number").reduce((a, b) => a + b, 0) /
    Object.values(scores).filter((v) => typeof v === "number").length;

  return {
    id: persona.id,
    businessName: persona.businessName,
    classifiedNiche,
    expectedNiche: persona.expectedNiche,
    vertical,
    tradePack,
    scores,
    overall: Math.round(overall * 10) / 10,
    overallBand: scoreBand(overall),
    trainCaraAboutTitle: trainCopy.about.title,
    checklistSuffix: dashCopy.home.goLiveChecklistSuffix,
    checklistLabels: checklistNoLink.map((i) => `${i.label}:${i.complete ? "✓" : "○"}`),
    checklistWithLinkLabels: persona.enquiryLink
      ? checklistWithLink.map((i) => `${i.label}:${i.complete ? "✓" : "○"}`)
      : null,
    faqChips,
    deterministicFaqs: detFaqs,
    servicesStepSubtitle: servicesCopy.subtitle,
    hoursParsed: hoursHasOpen,
    appointmentDaysOpen,
    salonBleedInPrompt,
    salonBleedInCopy,
    closedEveryDay,
    promptLen: prompt.length,
  };
}

function main() {
  const results = PERSONAS.map(ratePersona);

  console.log("\n=== Generic niche scorecard (post-fix) ===\n");

  for (const r of results) {
    console.log(`## ${r.businessName} (${r.id})`);
    console.log(
      `Niche: ${r.classifiedNiche} (expected ${r.expectedNiche}) · vertical: ${r.vertical} · tradePack: ${r.tradePack}`,
    );
    console.log(`Overall: ${r.overall}/5 (${r.overallBand})`);
    console.log("Scores:", JSON.stringify(r.scores, null, 2));
    console.log("Train Cara:", r.trainCaraAboutTitle);
    console.log("Checklist suffix:", r.checklistSuffix);
    console.log("Checklist (no link):", r.checklistLabels.join(", "));
    if (r.checklistWithLinkLabels) {
      console.log("Checklist (with enquiry link):", r.checklistWithLinkLabels.join(", "));
    }
    console.log("FAQ chips:", r.faqChips.join(" | "));
    console.log("Deterministic:", r.deterministicFaqs.join(" | "));
    console.log("Services step:", r.servicesStepSubtitle);
    console.log(
      "Hours:",
      r.hoursParsed ? "parsed with open days" : "FAILED",
      r.appointmentDaysOpen ? "" : "· appointment days still closed",
    );
    console.log(
      "Prompt:",
      r.salonBleedInPrompt ? "SALON BLEED" : "clean",
      r.closedEveryDay ? "· CLOSED EVERY DAY" : "",
      `(${r.promptLen} chars)`,
    );
    console.log("");
  }

  console.log("=== Summary table ===");
  console.log(
    "Persona".padEnd(14),
    "Niche".padEnd(8),
    "Overall".padEnd(8),
    "FAQ".padEnd(6),
    "Hours".padEnd(6),
    "Check".padEnd(6),
    "Prompt",
  );
  for (const r of results) {
    console.log(
      r.id.padEnd(14),
      r.classifiedNiche.padEnd(8),
      String(r.overall).padEnd(8),
      String(r.scores.faqChips).padEnd(6),
      String(r.scores.hoursSync).padEnd(6),
      String(r.scores.checklist).padEnd(6),
      String(r.scores.promptQuality),
    );
  }
}

main();
