import {
  ACTION_CATEGORY_LABELS,
  type ActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";
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
  verticalPackForNiche,
  type VerticalId,
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
  nav: {
    contactsLabel: string;
  };
  home: {
    heroSubheading: string;
    greetingSubline: string;
    goLiveChecklistSuffix: string;
  };
  calls: {
    emptyDescription: string;
  };
  contacts: {
    pageDescription: string;
    emptyDescription: string;
    selectDescription: string;
    savedContactLabel: string;
    savedContactNoCalls: string;
    savedContactNoCallsRecorded: string;
  };
  actionInbox: {
    categoryLabels: Record<ActionCategory, string>;
  };
  routing: {
    bookPresetLabel: string;
    bookPresetName: string;
    directionsPresetLabel: string;
    directionsPresetName: string;
    speakPresetLabel: string;
    speakPresetName: string;
    starterBookLabel: string;
    starterBookDescription: string;
    starterEnquiryLabel: string;
    starterEnquiryDescription: string;
    starterEnquiryPlaceholder: string;
    goLiveBookingLinkLabel: string;
    goLiveEnquiryLinkLabel: string;
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
    generalBasicsTitle: string;
    greetingHint: string;
    locationHint: string;
    commonQuestionsTitle: string;
  };
  training: {
    description: string;
  };
  team: {
    accessDescription: string;
  };
  locations: {
    subline: string;
  };
  settings: {
    businessIdentityTitle: string;
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
): DashboardVerticalCopy["routing"] {
  const override = ROUTING_OVERRIDES_BY_NICHE[niche] ?? {};
  return { ...base, ...override };
}

/** Extra routing field hints when business type narrows professional services. */
const _PROFESSIONAL_SERVICES_ROUTING_EXAMPLE_ROUTING: RoutingNicheOverrides = {
  exampleBlock: PROFESSIONAL_SERVICES_ROUTING_EXAMPLE,
  namePlaceholder: "e.g. New client consultations",
  keywordPlaceholder: "e.g. consultation",
  descriptionPlaceholder:
    "e.g. When they want a first meeting — not case updates or general admin",
  rulesPlaceholder:
    "e.g. Don't give advice on the call — take details for a callback",
};

const SALON_ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  booking_request: "Booking request — callback needed",
  callback: "Callback",
  urgent: "Urgent",
  confirm: "Booking to confirm",
  quote: "Price enquiry",
  lead: "New client enquiry",
  complaint: "Complaint",
  unclear: "Unclear request",
  failed: "Missed call",
  follow_up: "Follow-up needed",
};

type VerticalCopyBase = Omit<
  DashboardVerticalCopy,
  "vertical" | "niche" | "caraSetup"
> & {
  caraSetupBase: Pick<
    DashboardVerticalCopy["caraSetup"],
    | "servicesEmptyWarning"
    | "callHandlingRulesPlaceholder"
    | "detailsToCollectPlaceholder"
    | "generalBasicsTitle"
    | "greetingHint"
    | "locationHint"
    | "commonQuestionsTitle"
  >;
};

const SALON_COPY: VerticalCopyBase = {
  customerNoun: { singular: "client", plural: "clients" },
  nav: {
    contactsLabel: "Clients",
  },
  home: {
    heroSubheading: "Here's how the salon's looking today.",
    greetingSubline: "What Cara handled at the salon today.",
    goLiveChecklistSuffix: "can handle real client calls confidently.",
  },
  calls: {
    emptyDescription:
      "When Cara answers your salon line, calls appear here with summaries and outcomes.",
  },
  contacts: {
    pageDescription:
      "People who have called or are saved on your client list — with call history and open follow-ups.",
    emptyDescription:
      "When Cara answers calls, contacts appear here. Saved clients from bookings show up too.",
    selectDescription:
      "Choose a client to see how to reach them, their visits, and open follow-ups.",
    savedContactLabel: "Saved client",
    savedContactNoCalls: "Saved client · no calls yet",
    savedContactNoCallsRecorded: "Saved client · no calls recorded yet",
  },
  actionInbox: {
    categoryLabels: SALON_ACTION_CATEGORY_LABELS,
  },
  routing: {
    bookPresetLabel: "Book appointment",
    bookPresetName: "Book an appointment",
    directionsPresetLabel: "Get directions",
    directionsPresetName: "Where are you based",
    speakPresetLabel: "Speak to someone",
    speakPresetName: "Speak to someone",
    starterBookLabel: "Book an appointment",
    starterBookDescription: "Text a booking link when callers want to schedule.",
    starterEnquiryLabel: "Online booking link",
    starterEnquiryDescription: "Text a booking link when callers want to schedule.",
    starterEnquiryPlaceholder: "booksy.com/… or fresha.com/…",
    goLiveBookingLinkLabel: "Booking link",
    goLiveEnquiryLinkLabel: "Booking link",
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
    generalBasicsTitle: "Salon basics",
    greetingHint:
      "Introduce your salon — the AI and recording notice is added automatically.",
    locationHint:
      "The town your salon is in — Cara uses this for coverage and distance answers.",
    commonQuestionsTitle: "What clients always ask",
  },
  training: {
    description:
      "Fill the gaps clients hit on calls — preview what Cara learns, then confirm.",
  },
  team: {
    accessDescription: "Share access to calls, Action Inbox, and clients.",
  },
  locations: {
    subline: "Each salon gets its own number and Cara setup.",
  },
  settings: {
    businessIdentityTitle: "Salon details",
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

const GENERIC_COPY: VerticalCopyBase = {
  customerNoun: { singular: "contact", plural: "contacts" },
  nav: {
    contactsLabel: "Contacts",
  },
  home: {
    heroSubheading: "Here is how we are looking today.",
    greetingSubline: "Here is how we are looking today.",
    goLiveChecklistSuffix: "can handle real calls confidently.",
  },
  calls: {
    emptyDescription:
      "When Cara answers, calls will appear here with summaries and outcomes.",
  },
  contacts: {
    pageDescription:
      "People who have called or are saved in your contacts — with call history and open follow-ups.",
    emptyDescription:
      "When Cara answers calls, contacts appear here. Saved contacts show up here too.",
    selectDescription:
      "Choose someone from the directory to see how to reach them, their calls, and open follow-ups.",
    savedContactLabel: "Saved contact",
    savedContactNoCalls: "Saved contact · no calls yet",
    savedContactNoCallsRecorded: "Saved contact · no calls recorded yet",
  },
  actionInbox: {
    categoryLabels: ACTION_CATEGORY_LABELS,
  },
  routing: {
    bookPresetLabel: "Book an appointment",
    bookPresetName: "Book an appointment",
    directionsPresetLabel: "Get directions",
    directionsPresetName: "Where are you based",
    speakPresetLabel: "Speak to someone",
    speakPresetName: "Speak to someone",
    starterBookLabel: "Book an appointment",
    starterBookDescription:
      "Text a booking or scheduling link when callers want an appointment.",
    starterEnquiryLabel: "Website or enquiry link",
    starterEnquiryDescription:
      "Cara can text this when callers want more information or to start an enquiry — she won't promise availability she can't see.",
    starterEnquiryPlaceholder: "yoursite.com/contact or calendly.com/…",
    goLiveBookingLinkLabel: "Booking link",
    goLiveEnquiryLinkLabel: "Scheduling or enquiry link",
    keywordPlaceholder: "e.g. book an appointment",
    namePlaceholder: "e.g. Appointment requests",
    descriptionPlaceholder:
      "e.g. When they want to book — not a general question or quote",
    rulesPlaceholder:
      "e.g. Text the booking link — don't promise a slot Cara can't see",
    exampleBlock: DEFAULT_ROUTING_EXAMPLE,
    fieldHintExample: "booking vs general enquiry",
    flowTestPhrases: [
      "Can someone call me back?",
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
      "Cara can't confirm what you offer until you add it — until then she'll take a message for every request.",
    callHandlingRulesPlaceholder:
      "e.g. Never give prices over the phone, Always take a message if no one's free, Flag anything urgent",
    detailsToCollectPlaceholder:
      "e.g. Their name, what they need, and the best time to reach them",
    generalBasicsTitle: "Business basics",
    greetingHint:
      "Introduce your business — the AI and recording notice is added automatically.",
    locationHint:
      "The town your business is based in — Cara uses this for coverage and distance answers.",
    commonQuestionsTitle: "Common questions",
  },
  training: {
    description:
      "Answer gaps from calls in plain English — preview what Cara adds, then confirm.",
  },
  team: {
    accessDescription: "Share access to calls, Action Inbox, and contacts.",
  },
  locations: {
    subline: "Each site gets its own phone number and Cara setup.",
  },
  settings: {
    businessIdentityTitle: "Business identity",
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

const VERTICAL_COPY: Record<VerticalId, VerticalCopyBase> = {
  salon_beauty: SALON_COPY,
  generic: GENERIC_COPY,
};

/** Dashboard user-facing copy keyed off the org's vertical (salon vs generic). */
export function dashboardVerticalCopy(
  rawNiche: string | null | undefined,
  businessType?: string | null,
): DashboardVerticalCopy {
  const niche = parseOrganizationNiche(rawNiche);
  const vertical = verticalPackForNiche(niche);
  const base = VERTICAL_COPY[vertical.id] ?? GENERIC_COPY;

  return {
    vertical,
    niche,
    customerNoun: vertical.customerNoun,
    nav: base.nav,
    home: base.home,
    calls: base.calls,
    contacts: base.contacts,
    actionInbox: base.actionInbox,
    routing: routingCopyForNiche(niche, base.routing),
    caraSetup: {
      trainCara: trainCaraVerticalCopy(niche),
      services: packServicesStepCopy(businessType?.trim() ?? "", niche),
      ...base.caraSetupBase,
    },
    training: base.training,
    team: base.team,
    locations: base.locations,
    settings: base.settings,
    privacy: base.privacy,
    setupSteps: base.setupSteps,
  };
}
