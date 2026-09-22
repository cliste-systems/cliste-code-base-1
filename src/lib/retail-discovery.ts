import type {
  RetailRegressionCategory,
  RetailRegressionExpectation,
  RetailRegressionTurn,
} from "@/lib/retail-regression";

export type RetailDiscoveryProfile =
  | "lexical_collision"
  | "department_scope"
  | "explicit_fulfilment"
  | "rewards_price"
  | "context_switch"
  | "decisive_refinement"
  | "ambiguity_clarification"
  | "irish_stt"
  | "brand_size"
  | "vague_followup"
  | "mind_change"
  | "multi_question"
  | "unusual_product";

export type RetailDiscoveryIntent = "offer" | "price" | "stock";
export type RetailDiscoveryServiceArea =
  | "butcher"
  | "deli"
  | "fish"
  | "produce"
  | "bakery"
  | "dairy"
  | "off_licence"
  | "grocery";
export type RetailDiscoveryFulfilment = "counter" | "prepack";

export type RetailDiscoveryPlanEntry = {
  slot: number;
  profile: RetailDiscoveryProfile;
  intent?: RetailDiscoveryIntent;
  serviceArea?: RetailDiscoveryServiceArea;
  fulfilment?: RetailDiscoveryFulfilment;
  rewardsAmount?: string;
};

export type RetailDiscoveryGeneratedItem = {
  slot: number;
  title: string;
  turns: string[];
  queryTerms: string[];
};

export type RetailDiscoveryScenarioDraft = {
  title: string;
  category: RetailRegressionCategory;
  tags: string[];
  turns: RetailRegressionTurn[];
  expectations: RetailRegressionExpectation;
  discoveryProfile: RetailDiscoveryProfile;
};

const PRODUCT_TOOL = "searchSuperValuProducts";

const SERVICE_AREAS: RetailDiscoveryServiceArea[] = [
  "butcher",
  "deli",
  "fish",
  "produce",
  "bakery",
  "dairy",
  "off_licence",
  "grocery",
];

const REWARDS_AMOUNTS = ["2.50", "3.00", "4.00", "5.00", "6.00"];

const PROFILE_CYCLE: RetailDiscoveryProfile[] = [
  "lexical_collision",
  "department_scope",
  "explicit_fulfilment",
  "rewards_price",
  "context_switch",
  "decisive_refinement",
  "ambiguity_clarification",
  "irish_stt",
  "brand_size",
  "vague_followup",
  "mind_change",
  "multi_question",
  "unusual_product",
];

const INTENT_CYCLE: RetailDiscoveryIntent[] = ["offer", "price", "stock"];

export function buildRetailDiscoveryPlan(
  batchIndex: number,
  count: number,
): RetailDiscoveryPlanEntry[] {
  const safeCount = Math.max(1, Math.min(20, Math.trunc(count)));
  const offset = Math.max(0, Math.trunc(batchIndex)) * 20;

  return Array.from({ length: safeCount }, (_, localIndex) => {
    const globalIndex = offset + localIndex;
    const profile = PROFILE_CYCLE[globalIndex % PROFILE_CYCLE.length]!;
    const intent = INTENT_CYCLE[Math.floor(globalIndex / PROFILE_CYCLE.length) % INTENT_CYCLE.length]!;
    const serviceArea = SERVICE_AREAS[Math.floor(globalIndex / 2) % SERVICE_AREAS.length]!;

    if (profile === "rewards_price") {
      return {
        slot: localIndex,
        profile,
        intent: "offer",
        rewardsAmount: REWARDS_AMOUNTS[Math.floor(globalIndex / PROFILE_CYCLE.length) % REWARDS_AMOUNTS.length]!,
      };
    }

    if (profile === "explicit_fulfilment") {
      const counterAreas: RetailDiscoveryServiceArea[] = ["butcher", "deli", "fish"];
      return {
        slot: localIndex,
        profile,
        intent: "offer",
        serviceArea: counterAreas[globalIndex % counterAreas.length]!,
        fulfilment: globalIndex % 2 === 0 ? "counter" : "prepack",
      };
    }

    if (profile === "department_scope") {
      return { slot: localIndex, profile, intent, serviceArea };
    }

    if (profile === "context_switch") {
      return {
        slot: localIndex,
        profile,
        intent: globalIndex % 2 === 0 ? "stock" : "offer",
      };
    }

    if (profile === "decisive_refinement" || profile === "vague_followup") {
      return {
        slot: localIndex,
        profile,
        intent: globalIndex % 2 === 0 ? "price" : "offer",
      };
    }

    if (profile === "ambiguity_clarification") {
      return { slot: localIndex, profile };
    }

    if (profile === "mind_change") {
      return {
        slot: localIndex,
        profile,
        intent: globalIndex % 2 === 0 ? "stock" : "price",
      };
    }

    return { slot: localIndex, profile, intent };
  });
}

function categoryForProfile(profile: RetailDiscoveryProfile): RetailRegressionCategory {
  if (
    profile === "context_switch" ||
    profile === "decisive_refinement" ||
    profile === "vague_followup" ||
    profile === "mind_change"
  ) {
    return "multi_turn";
  }
  if (profile === "ambiguity_clarification") return "clarification";
  if (profile === "department_scope" || profile === "explicit_fulfilment") {
    return "departments";
  }
  if (profile === "rewards_price") return "offers";
  if (profile === "brand_size") return "prices";
  if (profile === "unusual_product") return "stock";
  return "edge_cases";
}

function safeTerms(values: string[]): string[] {
  return [...new Set(
    values
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter((value) => value.length >= 2 && value.length <= 60),
  )].slice(0, 4);
}

function baseProductExpectation(
  plan: RetailDiscoveryPlanEntry,
  terms: string[],
): RetailRegressionExpectation {
  return {
    summary: "Use the product lookup with the caller's intended product identity and intent.",
    requiredTool: PRODUCT_TOOL,
    requiredIntent: plan.intent ?? "stock",
    queryMustIncludeAny: terms,
    noError: true,
  };
}

function expectationsFor(
  plan: RetailDiscoveryPlanEntry,
  terms: string[],
): RetailRegressionExpectation {
  if (plan.profile === "ambiguity_clarification") {
    return {
      summary: "Recognise genuine ambiguity and ask one product-selection clarification instead of guessing.",
      mustAskClarifyingQuestion: true,
      noError: true,
    };
  }

  const expectation = baseProductExpectation(plan, terms);

  if (plan.profile === "lexical_collision") {
    return {
      ...expectation,
      summary: "Preserve the complete non-alcohol product identity despite misleading alcohol/department words.",
      forbiddenServiceAreas: ["off_licence", "alcohol"],
    };
  }

  if (plan.profile === "department_scope") {
    return {
      ...expectation,
      summary: `Keep the lookup hard-scoped to the explicitly named ${plan.serviceArea ?? "store"} area.`,
      requiredServiceArea: plan.serviceArea,
    };
  }

  if (plan.profile === "explicit_fulfilment") {
    return {
      ...expectation,
      summary: `Respect the caller's explicit ${plan.fulfilment ?? "fulfilment"} choice in the ${plan.serviceArea ?? "department"} area.`,
      requiredServiceArea: plan.serviceArea,
      requiredFulfilment: plan.fulfilment,
    };
  }

  if (plan.profile === "rewards_price") {
    return {
      ...expectation,
      summary: `Treat Rewards Price €${plan.rewardsAmount} as an exact price-point offer browse.`,
      requiredIntent: "offer",
      queryMustInclude: ["rewards", plan.rewardsAmount ?? ""].filter(Boolean),
      assistantMustNotInclude: [
        "can't search for offers by price",
        "cannot search for offers by price",
        "can't check specific price-point offers",
      ],
    };
  }

  if (plan.profile === "context_switch") {
    return {
      ...expectation,
      summary: "Let the newest explicit caller intent override the earlier turn while preserving the product context.",
    };
  }

  if (plan.profile === "decisive_refinement") {
    return {
      ...expectation,
      summary: "After a decisive follow-up selection, answer it without asking another type/brand/size question.",
      lastTurnMustNotAskClarifyingQuestion: true,
    };
  }

  if (plan.profile === "irish_stt") {
    return {
      ...expectation,
      summary: "Recover the intended product and intent from natural Irish/STT-like wording without routing to an unrelated area.",
    };
  }

  if (plan.profile === "brand_size") {
    return {
      ...expectation,
      summary: "Preserve the important brand/product/size identity instead of broadening to a category.",
    };
  }

  if (plan.profile === "vague_followup") {
    return {
      ...expectation,
      summary: "Carry the product context into a vague follow-up such as cheapest/big one/that one.",
      lastTurnMustNotAskClarifyingQuestion: true,
    };
  }

  if (plan.profile === "mind_change") {
    return {
      ...expectation,
      summary: "Follow the caller's changed mind and use the final explicit request rather than stale earlier intent.",
    };
  }

  if (plan.profile === "multi_question") {
    return {
      ...expectation,
      summary: "Handle a caller who bundles multiple details/questions without losing the core product lookup.",
    };
  }

  if (plan.profile === "unusual_product") {
    return {
      ...expectation,
      summary: "Look up an unusual product instead of guessing from common sense or inventing store stock.",
      assistantMustNotInclude: [
        "definitely in stock",
        "we definitely have",
        "guaranteed in stock",
      ],
    };
  }

  return expectation;
}

export function buildRetailDiscoveryScenarioDraft(
  plan: RetailDiscoveryPlanEntry,
  generated: RetailDiscoveryGeneratedItem,
): RetailDiscoveryScenarioDraft {
  if (generated.slot !== plan.slot) {
    throw new Error(`Discovery slot mismatch: expected ${plan.slot}, received ${generated.slot}.`);
  }

  const title = String(generated.title ?? "").trim().slice(0, 140);
  const turns = (Array.isArray(generated.turns) ? generated.turns : [])
    .map((caller) => String(caller ?? "").trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 4);
  const queryTerms = safeTerms(
    Array.isArray(generated.queryTerms) ? generated.queryTerms : [],
  );

  if (!title || turns.length === 0) {
    throw new Error(`Discovery slot ${plan.slot} did not contain a valid title and caller turn.`);
  }

  if (plan.profile !== "ambiguity_clarification" && queryTerms.length === 0) {
    throw new Error(`Discovery slot ${plan.slot} did not provide product query terms.`);
  }

  const expectedTurnCount =
    plan.profile === "context_switch" ||
    plan.profile === "decisive_refinement" ||
    plan.profile === "vague_followup"
      ? 2
      : plan.profile === "mind_change"
        ? 3
        : 1;

  if (turns.length < expectedTurnCount) {
    throw new Error(
      `Discovery slot ${plan.slot} requires at least ${expectedTurnCount} caller turns.`,
    );
  }

  return {
    title,
    category: categoryForProfile(plan.profile),
    tags: [
      "discovery",
      `discovery-family:${plan.profile}`,
      "fresh-generated",
      ...(plan.intent ? [`intent:${plan.intent}`] : []),
      ...(plan.serviceArea ? [`service-area:${plan.serviceArea}`] : []),
      ...(plan.fulfilment ? [`fulfilment:${plan.fulfilment}`] : []),
    ],
    turns: turns.map((caller) => ({ caller })),
    expectations: expectationsFor(plan, queryTerms),
    discoveryProfile: plan.profile,
  };
}
