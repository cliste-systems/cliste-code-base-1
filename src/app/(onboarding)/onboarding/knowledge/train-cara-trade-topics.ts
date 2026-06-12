/** Trade-aware topics for the "What should Cara know?" step (not FAQs). */

export type TradeKnowledgeTopicId =
  | "opening_hours"
  | "service_area"
  | "services_offered"
  | "emergency_callouts"
  | "location"
  | "pricing"
  | "walk_ins"
  | "typical_caller_needs";

export type TradeKnowledgeTopic = {
  id: TradeKnowledgeTopicId;
  label: string;
  ask: string;
  required: boolean;
};

export type CaraKnowledgeCollected = {
  openingHours: string;
  serviceArea: string;
  servicesOffered: string;
  emergencyCallouts: string;
  extraNotes: string;
  skippedTopics: TradeKnowledgeTopicId[];
};

export type TradePack = "trades" | "salon" | "default";

const TRADES_PATTERN =
  /plumb|electric|heat|hvac|locksmith|roof|build|handyman|gas engineer|drain|tradesperson|maintenance|landscap|paint|clean/i;

const SALON_PATTERN = /\b(salon|barber|hair|beauty|spa|nail|hairdress)\b/i;

export function detectTradePack(businessType: string): TradePack {
  const t = businessType.trim();
  if (!t) return "default";
  if (TRADES_PATTERN.test(t)) return "trades";
  if (SALON_PATTERN.test(t)) return "salon";
  return "default";
}

function hasLocationHint(collected: CaraKnowledgeCollected): boolean {
  const blob = `${collected.serviceArea} ${collected.extraNotes} ${collected.servicesOffered}`.toLowerCase();
  return /\b(based in|located|address|town|county|eircode|street)\b/.test(blob);
}

function hasPricingHint(collected: CaraKnowledgeCollected): boolean {
  return /price|pricing|quote|cost|fee|rate|€|\$|from \d/i.test(
    `${collected.extraNotes} ${collected.servicesOffered}`,
  );
}

export function isTradeTopicSatisfied(
  id: TradeKnowledgeTopicId,
  collected: CaraKnowledgeCollected,
): boolean {
  if (collected.skippedTopics.includes(id)) return true;

  switch (id) {
    case "opening_hours":
      return collected.openingHours.trim().length > 0;
    case "service_area":
      return collected.serviceArea.trim().length > 0;
    case "services_offered":
      return collected.servicesOffered.trim().length > 0;
    case "emergency_callouts":
      return collected.emergencyCallouts.trim().length > 0;
    case "location":
      return hasLocationHint(collected);
    case "pricing":
      return hasPricingHint(collected);
    case "walk_ins":
      return /\b(walk.?in|appointment|booking only|by appointment)\b/i.test(
        `${collected.extraNotes} ${collected.servicesOffered}`,
      );
    case "typical_caller_needs":
      return collected.extraNotes.trim().length > 30;
    default:
      return true;
  }
}

const UNIVERSAL_TOPICS: TradeKnowledgeTopic[] = [
  {
    id: "opening_hours",
    label: "Opening hours",
    required: true,
    ask: "What are your opening hours — which days are you open, and what times?",
  },
  {
    id: "service_area",
    label: "Service area",
    required: true,
    ask: "What areas do you cover for jobs or visits?",
  },
];

export function getTradeKnowledgeTopics(businessType: string): TradeKnowledgeTopic[] {
  const pack = detectTradePack(businessType);

  if (pack === "trades") {
    return [
      ...UNIVERSAL_TOPICS,
      {
        id: "services_offered",
        label: "Services",
        required: true,
        ask: "What services do you offer — repairs, installations, emergencies, and anything else callers should know?",
      },
      {
        id: "emergency_callouts",
        label: "Emergency callouts",
        required: false,
        ask: "Do you offer emergency or out-of-hours callouts? If yes, how should Cara explain that to callers?",
      },
      {
        id: "location",
        label: "Where you're based",
        required: false,
        ask: "Where are you based? (town or area callers should know)",
      },
      {
        id: "pricing",
        label: "Pricing",
        required: false,
        ask: "How should Cara explain your prices or quotes when callers ask?",
      },
    ];
  }

  if (pack === "salon") {
    return [
      ...UNIVERSAL_TOPICS,
      {
        id: "services_offered",
        label: "Services",
        required: true,
        ask: "What services do you offer — cuts, colour, treatments, and anything else callers ask about?",
      },
      {
        id: "walk_ins",
        label: "Walk-ins",
        required: false,
        ask: "Do you take walk-ins, or is it appointments only?",
      },
      {
        id: "location",
        label: "Where you're based",
        required: false,
        ask: "Where are you based? (town or area callers should know)",
      },
      {
        id: "pricing",
        label: "Pricing",
        required: false,
        ask: "How should Cara explain your prices when callers ask?",
      },
    ];
  }

  return [
    ...UNIVERSAL_TOPICS,
    {
      id: "services_offered",
      label: "What you offer",
      required: true,
      ask: "What do you offer or help callers with most often?",
    },
    {
      id: "typical_caller_needs",
      label: "Typical caller needs",
      required: false,
      ask: "What do callers usually need when they ring — booking, quotes, support, or something else?",
    },
    {
      id: "location",
      label: "Where you're based",
      required: false,
      ask: "Where are you based? (town or area callers should know)",
    },
    {
      id: "pricing",
      label: "Pricing",
      required: false,
      ask: "How should Cara explain your prices or quotes when callers ask?",
    },
  ];
}

export function tradeTopicIdsForType(businessType: string): TradeKnowledgeTopicId[] {
  return getTradeKnowledgeTopics(businessType).map((t) => t.id);
}

export function nextMissingTradeTopic(
  collected: CaraKnowledgeCollected,
  businessType: string,
): TradeKnowledgeTopic | null {
  for (const topic of getTradeKnowledgeTopics(businessType)) {
    if (!isTradeTopicSatisfied(topic.id, collected)) {
      return topic;
    }
  }
  return null;
}

export function isKnowledgeCollectionComplete(
  collected: CaraKnowledgeCollected,
  summary: string,
  businessType: string,
): boolean {
  if (summary.trim().length < 40) return false;
  for (const topic of getTradeKnowledgeTopics(businessType)) {
    if (topic.required && !isTradeTopicSatisfied(topic.id, collected)) {
      return false;
    }
  }
  return true;
}

export function formatExtraNotesForStorage(
  collected: Pick<CaraKnowledgeCollected, "extraNotes" | "emergencyCallouts">,
): string {
  const parts: string[] = [];
  if (collected.emergencyCallouts.trim()) {
    parts.push(`Emergency callouts: ${collected.emergencyCallouts.trim()}`);
  }
  if (collected.extraNotes.trim()) {
    parts.push(collected.extraNotes.trim());
  }
  return parts.join("\n\n");
}
