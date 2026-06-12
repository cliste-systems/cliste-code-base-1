import { trainCaraVerticalCopy } from "@/app/(onboarding)/onboarding/knowledge/train-cara-vertical-copy";
import {
  packServicesStepCopy,
  type ServicesStepCopy,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-services-copy";
import {
  parseOrganizationNiche,
  type OrganizationNiche,
} from "@/lib/organization-niche";
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
    /** “If customer wants to…” preset — sends a file (SMS link to PDF, etc.). */
    menuPresetLabel: string;
    menuPresetName: string;
    quotePresetLabel: string;
    quotePresetName: string;
    directionsPresetLabel: string;
    directionsPresetName: string;
    speakPresetLabel: string;
    speakPresetName: string;
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

const TRADES_ROUTING_EXAMPLE: RoutingExampleBlock = {
  name: "Emergency callouts — your label in the list",
  keywords: "emergency, urgent, same day, leak",
  description: "When they need someone out today — not a routine quote",
  rules: "Confirm the address before promising a callback time",
};

const PROFESSIONAL_SERVICES_ROUTING_EXAMPLE: RoutingExampleBlock = {
  name: "New client consultations — your label in the list",
  keywords: "consultation, first appointment, speak to a solicitor",
  description:
    "When they want to book an initial meeting — not general admin or case updates",
  rules: "Don't give legal advice on the call — take details for a callback",
};

const HOSPITALITY_ROUTING_EXAMPLE: RoutingExampleBlock = {
  name: "Table bookings — your label in the list",
  keywords: "book a table, reservation, dinner tonight",
  description: "When they want to reserve a table — not takeaway or directions alone",
  rules: "Ask party size and preferred time before texting the booking link",
};

const FITNESS_ROUTING_EXAMPLE: RoutingExampleBlock = {
  name: "Class bookings — your label in the list",
  keywords: "book a class, yoga session, personal training",
  description: "When they want to schedule a session — not membership pricing alone",
  rules: "Mention any intro offer only if it's on your booking page",
};

const DEFAULT_ROUTING_EXAMPLE: RoutingExampleBlock = {
  name: "Appointment requests — your label in the list",
  keywords: "book an appointment, schedule a visit, make a booking",
  description:
    "When they want to book time with you — not a general question or quote",
  rules: "Text the booking link — don't promise a slot Cara can't see",
};

type RoutingNicheOverrides = Partial<DashboardVerticalCopy["routing"]>;

const ROUTING_OVERRIDES_BY_NICHE: Partial<
  Record<OrganizationNiche, RoutingNicheOverrides>
> = {
  trades: {
    exampleBlock: TRADES_ROUTING_EXAMPLE,
    keywordPlaceholder: "e.g. emergency callout",
    namePlaceholder: "e.g. Emergency callouts",
    descriptionPlaceholder:
      "e.g. When they need someone out today — not a routine quote",
    rulesPlaceholder: "e.g. Confirm the address before promising a callback time",
    fieldHintExample: "emergency vs routine quote",
    flowTestPhrases: [
      "I've got a leak",
      "Can I get a quote?",
      "Can I speak to someone?",
    ],
    routeNameExamples: [
      "emergency callout",
      "how much for a boiler service",
      "where are you based",
    ],
    traceSamplePhrases: ["I've got a leak — can someone come today?"],
  },
  home_services: {
    exampleBlock: TRADES_ROUTING_EXAMPLE,
    keywordPlaceholder: "e.g. same-day callout",
    namePlaceholder: "e.g. Urgent callouts",
    descriptionPlaceholder:
      "e.g. When they need someone today — not a routine service visit",
    rulesPlaceholder: "e.g. Confirm the address before promising a callback time",
    fieldHintExample: "urgent vs routine visit",
  },
  professional_services: {
    exampleBlock: PROFESSIONAL_SERVICES_ROUTING_EXAMPLE,
    keywordPlaceholder: "e.g. consultation",
    namePlaceholder: "e.g. New client consultations",
    descriptionPlaceholder:
      "e.g. When they want a first meeting — not case updates or general admin",
    rulesPlaceholder:
      "e.g. Don't give advice on the call — take details for a callback",
    fieldHintExample: "new client vs existing case",
    flowTestPhrases: [
      "I'd like to book a consultation",
      "Can I speak to someone about my case?",
      "What are your fees?",
    ],
    routeNameExamples: [
      "book a consultation",
      "speak to someone",
      "where are you based",
    ],
    traceSamplePhrases: ["I'd like to book a consultation"],
  },
  hospitality: {
    exampleBlock: HOSPITALITY_ROUTING_EXAMPLE,
    menuPresetLabel: "View menu",
    menuPresetName: "See the menu",
    keywordPlaceholder: "e.g. book a table",
    namePlaceholder: "e.g. Table bookings",
    descriptionPlaceholder:
      "e.g. When they want to reserve — not takeaway or directions alone",
    rulesPlaceholder: "e.g. Ask party size before texting the booking link",
    fieldHintExample: "reservation vs takeaway",
    flowTestPhrases: [
      "Can I book a table for tonight?",
      "What's on the menu?",
      "Where are you?",
    ],
    traceSamplePhrases: ["Can I book a table for tonight?"],
  },
  fitness: {
    exampleBlock: FITNESS_ROUTING_EXAMPLE,
    keywordPlaceholder: "e.g. personal training",
    namePlaceholder: "e.g. Class bookings",
    descriptionPlaceholder:
      "e.g. When they want to book a session — not membership pricing alone",
    rulesPlaceholder: "e.g. Mention intro offers only if they're on your booking page",
    fieldHintExample: "class booking vs membership enquiry",
    flowTestPhrases: [
      "Can I book a class?",
      "How much is membership?",
      "Can I speak to someone?",
    ],
    traceSamplePhrases: ["Can I book a yoga class?"],
  },
  automotive: {
    exampleBlock: {
      name: "Service bookings — your label in the list",
      keywords: "book a service, MOT, repair appointment",
      description: "When they want to book the car in — not parts pricing alone",
      rules: "Confirm registration if they mention a specific vehicle issue",
    },
    keywordPlaceholder: "e.g. MOT booking",
    namePlaceholder: "e.g. Service bookings",
    fieldHintExample: "service booking vs parts enquiry",
  },
  retail: {
    exampleBlock: {
      name: "Product enquiries — your label in the list",
      keywords: "in stock, opening hours, click and collect",
      description: "When they ask about products or visiting — not complaints",
      rules: "Text the product or store link — don't guess stock levels",
    },
    keywordPlaceholder: "e.g. in stock",
    namePlaceholder: "e.g. Product enquiries",
    fieldHintExample: "stock check vs complaint",
  },
  ecommerce: {
    exampleBlock: {
      name: "Order help — your label in the list",
      keywords: "track my order, delivery, return",
      description: "When they need help with an order — not new sales pitches",
      rules: "Text the order or help link — don't read out tracking numbers",
    },
    keywordPlaceholder: "e.g. track order",
    namePlaceholder: "e.g. Order help",
    fieldHintExample: "order status vs new sale",
  },
  events: {
    exampleBlock: {
      name: "Event enquiries — your label in the list",
      keywords: "book the venue, availability, quote for a party",
      description: "When they want to hire you — not general opening hours",
      rules: "Capture date, headcount, and event type before promising availability",
    },
    keywordPlaceholder: "e.g. venue hire",
    namePlaceholder: "e.g. Event enquiries",
    fieldHintExample: "hire enquiry vs general question",
  },
  education: {
    exampleBlock: {
      name: "Course enrolment — your label in the list",
      keywords: "sign up, enrol, start date, course availability",
      description: "When they want to join a course — not general information alone",
      rules: "Text the enrolment link — mention prerequisites if they're on your site",
    },
    keywordPlaceholder: "e.g. enrol",
    namePlaceholder: "e.g. Course enrolment",
    fieldHintExample: "enrolment vs general info",
  },
  other: {
    exampleBlock: DEFAULT_ROUTING_EXAMPLE,
    keywordPlaceholder: "e.g. book an appointment",
    namePlaceholder: "e.g. Appointment requests",
    descriptionPlaceholder:
      "e.g. When they want to book — not a general question or quote",
    rulesPlaceholder:
      "e.g. Text the booking link — don't promise a slot Cara can't see",
    fieldHintExample: "booking vs general enquiry",
  },
};

function routingCopyForNiche(
  niche: OrganizationNiche,
  base: DashboardVerticalCopy["routing"],
  isSalon: boolean,
  businessType?: string,
): DashboardVerticalCopy["routing"] {
  if (isSalon) return base;
  const overrides = ROUTING_OVERRIDES_BY_NICHE[niche];
  let routing = overrides
    ? { ...base, ...overrides }
    : { ...base, exampleBlock: DEFAULT_ROUTING_EXAMPLE };

  const bt = businessType?.trim().toLowerCase() ?? "";
  if (niche === "professional_services" && bt.includes("law")) {
    routing = { ...routing, ...PROFESSIONAL_SERVICES_ROUTING_EXAMPLE_ROUTING };
  }

  return routing;
}

/** Extra routing field hints when business type narrows professional services. */
const PROFESSIONAL_SERVICES_ROUTING_EXAMPLE_ROUTING: RoutingNicheOverrides = {
  exampleBlock: PROFESSIONAL_SERVICES_ROUTING_EXAMPLE,
  namePlaceholder: "e.g. New client consultations",
  keywordPlaceholder: "e.g. consultation",
  descriptionPlaceholder:
    "e.g. When they want a first meeting — not case updates or general admin",
  rulesPlaceholder:
    "e.g. Don't give advice on the call — take details for a callback",
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
    menuPresetLabel: "Services & prices",
    menuPresetName: "See services and prices",
    quotePresetLabel: "Ask about pricing",
    quotePresetName: "Ask how much something costs",
    directionsPresetLabel: "Get directions",
    directionsPresetName: "Where are you based",
    speakPresetLabel: "Speak to someone",
    speakPresetName: "Speak to someone",
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
    bookPresetLabel: "Book an appointment",
    bookPresetName: "Book an appointment",
    menuPresetLabel: "Brochure or price list",
    menuPresetName: "Get a brochure or price list",
    quotePresetLabel: "Get a quote",
    quotePresetName: "Get a quote",
    directionsPresetLabel: "Get directions",
    directionsPresetName: "Where are you based",
    speakPresetLabel: "Speak to someone",
    speakPresetName: "Speak to someone",
    starterBookLabel: "Book an appointment",
    starterBookDescription:
      "Text a booking or scheduling link when callers want an appointment.",
    keywordPlaceholder: "e.g. book an appointment",
    namePlaceholder: "e.g. Appointment requests",
    descriptionPlaceholder:
      "e.g. When they want to book — not a general question or quote",
    rulesPlaceholder:
      "e.g. Text the booking link — don't promise a slot Cara can't see",
    exampleBlock: DEFAULT_ROUTING_EXAMPLE,
    fieldHintExample: "booking vs general enquiry",
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
    routing: routingCopyForNiche(niche, base.routing, isSalon, bt || undefined),
    caraSetup: {
      trainCara: trainCaraVerticalCopy(niche),
      services: packServicesStepCopy(bt, niche),
      ...base.caraSetupBase,
    },
    privacy: base.privacy,
    setupSteps: base.setupSteps,
  };
}
