import { trainCaraVerticalCopy } from "@/app/(onboarding)/onboarding/knowledge/train-cara-vertical-copy";
import {
  packServicesStepCopy,
  type ServicesStepCopy,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-services-copy";
import { parseOrganizationNiche } from "@/lib/organization-niche";
import {
  verticalIdForNiche,
  verticalPackForNiche,
  type VerticalPack,
} from "@/lib/verticals";

export type RoutingExampleBlock = {
  name: string;
  keywords: string;
  description: string;
  rules: string;
};

export type DashboardVerticalCopy = {
  vertical: VerticalPack;
  niche: string;
  customerNoun: { singular: string; plural: string };
  contacts: {
    pageDescription: string;
    emptyDescription: string;
    savedContactLabel: string;
    savedContactNoCalls: string;
    savedContactNoCallsRecorded: string;
  };
  routing: {
    bookPresetLabel: string;
    bookPresetName: string;
    starterBookLabel: string;
    starterBookDescription: string;
    keywordPlaceholder: string;
    namePlaceholder: string;
    descriptionPlaceholder: string;
    rulesPlaceholder: string;
    exampleBlock: RoutingExampleBlock | null;
    fieldHintExample: string;
    flowTestPhrases: readonly string[];
    flowTestPlaceholder: string;
    routeNameExamples: readonly string[];
    routeNamePlaceholder: string;
    saveConfirmLinkNoun: string;
    traceSamplePhrases: readonly string[];
  };
  caraSetup: {
    trainCara: ReturnType<typeof trainCaraVerticalCopy>;
    services: ServicesStepCopy;
    servicesEmptyWarning: string;
    callHandlingRulesPlaceholder: string;
    detailsToCollectPlaceholder: string;
  };
  privacy: {
    exportNoun: string;
    exportListIntro: string;
    eraseCountNoun: string;
  };
  setupSteps: {
    addServicesLabel: string;
  };
};

const SALON_ROUTING_EXAMPLE: RoutingExampleBlock = {
  name: "Colour bookings — your label in the list",
  keywords: "balayage, roots touch-up, full colour",
  description: "When they want colour work — not a wash and cut alone",
  rules: "Mention the 48-hour skin test before any full colour",
};

const GENERIC_ROUTING_EXAMPLE: RoutingExampleBlock = {
  name: "Emergency callouts — your label in the list",
  keywords: "emergency, urgent, same day, leak",
  description: "When they need someone out today — not a routine quote",
  rules: "Confirm the address before promising a callback time",
};

const SALON_COPY: Omit<DashboardVerticalCopy, "vertical" | "niche" | "caraSetup"> & {
  caraSetupBase: Pick<
    DashboardVerticalCopy["caraSetup"],
    "servicesEmptyWarning" | "callHandlingRulesPlaceholder" | "detailsToCollectPlaceholder"
  >;
} = {
  customerNoun: { singular: "client", plural: "clients" },
  contacts: {
    pageDescription:
      "People who have called or are saved on your client list — with call history and open follow-ups.",
    emptyDescription:
      "When Cara answers calls, contacts appear here. Saved clients from bookings show up too.",
    savedContactLabel: "Saved client",
    savedContactNoCalls: "Saved client · no calls yet",
    savedContactNoCallsRecorded: "Saved client · no calls recorded yet",
  },
  routing: {
    bookPresetLabel: "Book appointment",
    bookPresetName: "Book an appointment",
    starterBookLabel: "Book an appointment",
    starterBookDescription: "Text a booking link when callers want to schedule.",
    keywordPlaceholder: "e.g. balayage",
    namePlaceholder: "e.g. Colour bookings",
    descriptionPlaceholder:
      "e.g. When they want colour, balayage, or highlights — not a wash and cut alone",
    rulesPlaceholder:
      "e.g. Mention the 48-hour skin test before any full colour appointment",
    exampleBlock: SALON_ROUTING_EXAMPLE,
    fieldHintExample: "colour vs cut",
    flowTestPhrases: [
      "I want to change my booking",
      "Can I book an appointment?",
      "Can I speak to someone?",
    ],
    flowTestPlaceholder: 'e.g. "I want to change my booking"',
    routeNameExamples: [
      "book an appointment",
      "how much is a haircut",
      "where are you based",
    ],
    routeNamePlaceholder: 'e.g. "Can I book an appointment?"',
    saveConfirmLinkNoun: "booking links",
    traceSamplePhrases: ["How much is a haircut?"],
  },
  caraSetupBase: {
    servicesEmptyWarning:
      "Cara can't confirm any services until you add what you offer — she'll take a message for every booking request.",
    callHandlingRulesPlaceholder:
      "e.g. 48 hours notice to cancel, Don't book new clients on Mondays",
    detailsToCollectPlaceholder:
      "e.g. Service they want, preferred day, stylist if they have one",
  },
  privacy: {
    exportNoun: "appointment",
    exportListIntro:
      "every appointment, call log, and action-inbox ticket for that phone number in your account.",
    eraseCountNoun: "appointments",
  },
  setupSteps: {
    addServicesLabel: "Add services",
  },
};

const GENERIC_COPY: Omit<DashboardVerticalCopy, "vertical" | "niche" | "caraSetup"> & {
  caraSetupBase: Pick<
    DashboardVerticalCopy["caraSetup"],
    "servicesEmptyWarning" | "callHandlingRulesPlaceholder" | "detailsToCollectPlaceholder"
  >;
} = {
  customerNoun: { singular: "caller", plural: "callers" },
  contacts: {
    pageDescription:
      "People who have called or are saved in your contacts — with call history and open follow-ups.",
    emptyDescription:
      "When Cara answers calls, contacts appear here. Saved contacts show up here too.",
    savedContactLabel: "Saved contact",
    savedContactNoCalls: "Saved contact · no calls yet",
    savedContactNoCallsRecorded: "Saved contact · no calls recorded yet",
  },
  routing: {
    bookPresetLabel: "Make an enquiry",
    bookPresetName: "Make an enquiry",
    starterBookLabel: "Make an enquiry",
    starterBookDescription: "Text a link when callers want more information or to get in touch.",
    keywordPlaceholder: "e.g. emergency callout",
    namePlaceholder: "e.g. Emergency callouts",
    descriptionPlaceholder:
      "e.g. When they need someone out today — not a routine quote or general question",
    rulesPlaceholder:
      "e.g. Confirm the address before promising a callback time",
    exampleBlock: GENERIC_ROUTING_EXAMPLE,
    fieldHintExample: "service type vs general enquiry",
    flowTestPhrases: [
      "I need a quote",
      "Can someone call me back?",
      "Can I speak to someone?",
    ],
    flowTestPlaceholder: 'e.g. "Can someone call me back?"',
    routeNameExamples: [
      "how much does it cost",
      "can someone call me back",
      "where are you based",
    ],
    routeNamePlaceholder: 'e.g. "Can someone call me back?"',
    saveConfirmLinkNoun: "links",
    traceSamplePhrases: ["How much does it cost?"],
  },
  caraSetupBase: {
    servicesEmptyWarning:
      "Cara can't confirm any work until you add what you offer — she'll take a message for every job request.",
    callHandlingRulesPlaceholder:
      "e.g. Never quote a price over the phone, No same-day jobs without a deposit",
    detailsToCollectPlaceholder:
      "e.g. What they need, address or area, best time to call back",
  },
  privacy: {
    exportNoun: "record",
    exportListIntro:
      "every record, call log, and action-inbox ticket for that phone number in your account.",
    eraseCountNoun: "records",
  },
  setupSteps: {
    addServicesLabel: "Add what you offer",
  },
};

/** Dashboard user-facing copy keyed off the org's vertical (salon vs generic). */
export function dashboardVerticalCopy(
  rawNiche: string | null | undefined,
  businessType?: string | null,
): DashboardVerticalCopy {
  const niche = parseOrganizationNiche(rawNiche);
  const vertical = verticalPackForNiche(niche);
  const isSalon = verticalIdForNiche(niche) === "salon_beauty";
  const base = isSalon ? SALON_COPY : GENERIC_COPY;
  const bt = businessType?.trim() ?? "";

  return {
    vertical,
    niche,
    customerNoun: vertical.customerNoun,
    contacts: base.contacts,
    routing: base.routing,
    caraSetup: {
      trainCara: trainCaraVerticalCopy(niche),
      services: packServicesStepCopy(bt, niche),
      ...base.caraSetupBase,
    },
    privacy: base.privacy,
    setupSteps: base.setupSteps,
  };
}
