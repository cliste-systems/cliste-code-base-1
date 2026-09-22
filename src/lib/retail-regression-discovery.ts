import "server-only";

import { randomUUID } from "node:crypto";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import type {
  RetailRegressionCategory,
  RetailRegressionExpectation,
  RetailRegressionScenario,
} from "@/lib/retail-regression";

export type RetailDiscoveryCount = 100 | 250 | 500;
export type RetailDiscoveryBatchCount = 10 | 15 | 20 | 25;

type DiscoveryDraft = Pick<
  RetailRegressionScenario,
  "title" | "category" | "tags" | "turns" | "expectations"
>;

const ALLOWED_CATEGORIES = new Set<RetailRegressionCategory>([
  "openings",
  "products",
  "prices",
  "stock",
  "offers",
  "departments",
  "knowledge",
  "clarification",
  "multi_turn",
  "edge_cases",
]);

const ALLOWED_SERVICE_AREAS = new Set([
  "butcher",
  "deli",
  "fish",
  "produce",
  "bakery",
  "dairy",
  "off_licence",
  "grocery",
]);

const ALLOWED_FULFILMENT = new Set(["counter", "prepack"]);

function cleanStringList(value: unknown, max = 10): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = [
    ...new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  ].slice(0, max);
  return cleaned.length ? cleaned : undefined;
}

function normalizeCaller(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasExplicitServiceArea(callerText: string, serviceArea: string): boolean {
  const text = normalizeCaller(callerText);
  const explicitPatterns: Record<string, RegExp> = {
    butcher: /\b(?:butcher(?:'s)?|meat counter|fresh meat counter)\b/,
    deli: /\b(?:deli|delicatessen)\b/,
    fish: /\b(?:fish counter|seafood counter|fresh fish counter)\b/,
    produce: /\b(?:produce|fruit\s*(?:&|and)\s*veg|veg section|fruit section)\b/,
    bakery: /\b(?:bakery|bakery section|bread counter)\b/,
    dairy: /\b(?:dairy wall|dairy section|dairy aisle)\b/,
    off_licence: /\b(?:off[- ]?licen[cs]e|wine aisle|beer aisle|alcohol aisle|offie)\b/,
    grocery: /\b(?:grocery aisle|grocery section|grocery)\b/,
  };

  if (explicitPatterns[serviceArea]?.test(text)) return true;

  if (serviceArea === "produce") {
    return /\b(?:apple|apples|pear|pears|avocado|avocados|vegetable|vegetables|veg|fruit)\b/.test(
      text,
    );
  }
  if (serviceArea === "dairy") {
    return /\b(?:milk|yogurt|yoghurt|cheese|butter)\b/.test(text);
  }
  if (serviceArea === "bakery") {
    return /\b(?:bread|rolls?|baguettes?|ciabatta|sourdough)\b/.test(text);
  }
  if (serviceArea === "butcher") {
    return /\b(?:steaks?|beef|chicken breasts?|pork chops?|lamb)\b/.test(text);
  }
  if (serviceArea === "fish") {
    return (
      /\b(?:salmon|cod|haddock|mackerel|seafood)\b/.test(text) &&
      !/\bfish fingers?\b/.test(text)
    );
  }
  if (serviceArea === "off_licence") {
    return (
      /\b(?:wine|beer|lager|cider|whiskey|whisky|vodka|gin|stout)\b/.test(text) &&
      !/\b(?:vinegar|wine gums?|beer battered|cider vinegar)\b/.test(text)
    );
  }

  return false;
}

function hasExplicitFulfilment(callerText: string, fulfilment: string): boolean {
  const text = normalizeCaller(callerText);
  if (fulfilment === "counter") {
    return /\b(?:counter|butcher(?:'s)?|deli|fish counter|meat counter)\b/.test(text);
  }
  return /\b(?:pre[- ]?pack(?:ed)?|packet aisle|prepacked)\b/.test(text);
}

function intentSignals(callerText: string): Set<"offer" | "price" | "stock"> {
  const text = normalizeCaller(callerText);
  const signals = new Set<"offer" | "price" | "stock">();

  if (
    /\b(?:offer|offers|deal|deals|special|specials|reduced|reduction|discount|multibuy|multi-buy|half price|rewards)\b/.test(
      text,
    )
  ) {
    signals.add("offer");
  }
  if (
    /\b(?:price|cost|how much|cheapest|cheap|lowest price|fiver|euro|€)\b/.test(text)
  ) {
    signals.add("price");
  }
  if (
    /\b(?:in stock|stock|do you have|have you got|have ye got|do ye have|sell|available|in today|carry)\b/.test(
      text,
    )
  ) {
    signals.add("stock");
  }

  return signals;
}

function looksGenuinelyAmbiguous(callerText: string): boolean {
  const text = normalizeCaller(callerText);
  return (
    /\b(?:that|those|them|something|the one|which one|big packet|big pack|value pack|fancy|usual sort|not sure|can't remember|cannot remember)\b/.test(
      text,
    ) ||
    /\b(?:some|a bit of)\s+(?:steak|chicken)\b/.test(text) ||
    /\bsteak(?:s)?\b/.test(text) && !/\b(?:counter|pre[- ]?pack)\b/.test(text)
  );
}

function isStoreKnowledgeOnly(callerText: string): boolean {
  const text = normalizeCaller(callerText);
  const storeInfo =
    /\b(?:opening hours?|what time.*(?:open|close|shut)|parking|car park|toilets?|atm|click\s*(?:&|and)\s*collect|delivery policy|shopping trolleys?|where.*trolleys?)\b/.test(
      text,
    );
  const productIntent =
    /\b(?:price|how much|offer|deal|stock|sell|do you have|have you got|have ye got|do ye have)\b/.test(
      text,
    );
  return storeInfo && !productIntent;
}

function isRedundantIntentQueryTerm(
  term: string,
  requiredIntent: string | undefined,
): boolean {
  const normalized = normalizeCaller(term);
  if (requiredIntent === "offer") {
    return /^(?:offer|offers|deal|deals|special|special offer|discount|reduced|reduction)$/.test(
      normalized,
    );
  }
  if (requiredIntent === "price") {
    return /^(?:price|cost|how much)$/.test(normalized);
  }
  if (requiredIntent === "stock") {
    return /^(?:stock|in stock|available)$/.test(normalized);
  }
  return false;
}

function callerContainsExpectationTerm(callerText: string, term: string): boolean {
  const caller = normalizeCaller(callerText);
  const expected = normalizeCaller(term);
  if (!expected) return false;
  if (caller.includes(expected)) return true;

  const aliasGroups = [
    ["fiver", "5 euro", "five euro", "€5", "5.00"],
    ["two fifty", "2.50", "two euro fifty", "€2.50"],
    ["half price", "50% off", "50 percent off"],
    ["multibuy", "multi-buy", "multi buy"],
    ["cheapest", "lowest price", "cheap"],
  ];

  return aliasGroups.some(
    (group) =>
      group.includes(expected) && group.some((alias) => caller.includes(alias)),
  );
}

function safeAssistantForbiddenPhrases(value: unknown): string[] | undefined {
  const phrases = cleanStringList(value, 6);
  const safe = phrases?.filter((phrase) =>
    /\b(?:definitely|guaranteed|guarantee|100%|one hundred percent|certainly in stock)\b/i.test(
      phrase,
    ),
  );
  return safe?.length ? safe : undefined;
}

function sanitizeExpectations(
  value: unknown,
  callerTurns: string[],
): RetailRegressionExpectation {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim().slice(0, 300)
      : "Cara should handle this caller scenario safely and without inventing facts.";

  const callerText = callerTurns.join(" ");
  const finalCaller = callerTurns.at(-1) ?? "";
  const signals = intentSignals(callerText);
  const expectation: RetailRegressionExpectation = {
    summary,
    noError: raw.noError !== false,
  };

  const wantsClarification =
    raw.mustAskClarifyingQuestion === true &&
    looksGenuinelyAmbiguous(finalCaller);
  if (wantsClarification) {
    expectation.mustAskClarifyingQuestion = true;
  }

  const canRequireProductTool =
    raw.requiredTool === "searchSuperValuProducts" &&
    !(callerTurns.length === 1 && wantsClarification);
  if (canRequireProductTool) {
    expectation.requiredTool = "searchSuperValuProducts";
  }

  const forbiddenTools = cleanStringList(raw.forbiddenTools, 5);
  if (
    forbiddenTools?.includes("searchSuperValuProducts") &&
    isStoreKnowledgeOnly(callerText)
  ) {
    expectation.forbiddenTools = ["searchSuperValuProducts"];
  }

  const rawIntent = String(raw.requiredIntent ?? "");
  if (
    canRequireProductTool &&
    ["offer", "price", "stock"].includes(rawIntent) &&
    signals.size <= 1
  ) {
    expectation.requiredIntent = rawIntent;
  }

  if (canRequireProductTool) {
    const requiredAll = cleanStringList(raw.queryMustInclude, 8)?.filter(
      (term) =>
        callerContainsExpectationTerm(callerText, term) &&
        !isRedundantIntentQueryTerm(term, expectation.requiredIntent),
    );
    if (requiredAll?.length) expectation.queryMustInclude = requiredAll;

    const requiredAny = cleanStringList(raw.queryMustIncludeAny, 8)?.filter(
      (term) =>
        callerContainsExpectationTerm(callerText, term) &&
        !isRedundantIntentQueryTerm(term, expectation.requiredIntent),
    );
    if (requiredAny?.length) expectation.queryMustIncludeAny = requiredAny;

    const serviceArea = String(raw.requiredServiceArea ?? "");
    if (
      ALLOWED_SERVICE_AREAS.has(serviceArea) &&
      hasExplicitServiceArea(callerText, serviceArea)
    ) {
      expectation.requiredServiceArea = serviceArea;
    }

    const fulfilment = String(raw.requiredFulfilment ?? "");
    if (
      ALLOWED_FULFILMENT.has(fulfilment) &&
      hasExplicitFulfilment(callerText, fulfilment)
    ) {
      expectation.requiredFulfilment = fulfilment as "counter" | "prepack";
    }

    const forbiddenServiceAreas = cleanStringList(
      raw.forbiddenServiceAreas,
      5,
    )?.filter((area) => ALLOWED_SERVICE_AREAS.has(area));
    if (forbiddenServiceAreas?.length) {
      expectation.forbiddenServiceAreas = forbiddenServiceAreas;
    }
  }

  const assistantForbidden = safeAssistantForbiddenPhrases(
    raw.assistantMustNotInclude,
  );
  if (assistantForbidden) {
    expectation.assistantMustNotInclude = assistantForbidden;
  }

  return expectation;
}

export function sanitizeRetailDiscoveryDraft(
  value: unknown,
): DiscoveryDraft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const callerTurns = Array.isArray(raw.turns)
    ? raw.turns
        .map((turn) => {
          if (typeof turn === "string") return turn.trim();
          if (turn && typeof turn === "object" && "caller" in turn) {
            return String((turn as { caller?: unknown }).caller ?? "").trim();
          }
          return "";
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];

  if (callerTurns.length === 0) return null;

  const categoryRaw = String(
    raw.category ?? "edge_cases",
  ) as RetailRegressionCategory;
  const category = ALLOWED_CATEGORIES.has(categoryRaw)
    ? categoryRaw
    : "edge_cases";

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 140)
      : callerTurns[0]!.slice(0, 120);

  return {
    title,
    category,
    tags: cleanStringList(raw.tags, 8) ?? ["discovery"],
    turns: callerTurns.map((caller) => ({ caller: caller.slice(0, 300) })),
    expectations: sanitizeExpectations(raw.expectations, callerTurns),
  };
}

function normalizeConversation(draft: DiscoveryDraft): string {
  return draft.turns
    .map((turn) => turn.caller.toLowerCase().replace(/\s+/g, " ").trim())
    .join(" || ");
}

export async function generateRetailDiscoveryDrafts(input: {
  count: RetailDiscoveryBatchCount;
  batchIndex: number;
}): Promise<Array<DiscoveryDraft & { discoveryKey: string }>> {
  const nonce = randomUUID();
  const raw = await completeOpenRouterChat({
    temperature: 0.95,
    maxTokens: 9000,
    messages: [
      {
        role: "system",
        content: `You are an adversarial QA scenario generator for HelloCara, an AI phone assistant answering calls for an Irish supermarket.

Generate EXACTLY ${input.count} NEW test scenarios. This is discovery/stress testing, not paraphrasing a known test. Try to expose realistic failures the existing suite may not anticipate.

Vary aggressively across:
- unusual or obscure supermarket products;
- misleading product names and category collisions (words like wine, beer, dairy, cider, fish, steak that can appear in non-obvious products);
- vague callers ("the big packet", "the cheap one", "whatever's on offer");
- natural Donegal/Irish/UK wording, fragments and conversational fillers;
- plausible STT/transcription mistakes and spelling noise, never nonsense;
- caller changes their mind or corrects themselves;
- 2-4 turn conversations with context carried across turns;
- multiple questions in one utterance;
- new promotion wording: Rewards, multibuy, save amounts, half price, reduced, cheapest;
- caller asks for something the assistant genuinely cannot know and must not invent;
- counter vs pre-pack ambiguity and later clarification;
- department-scoped questions: butcher, deli, fish, produce, bakery, dairy, off-licence, grocery;
- store-knowledge questions that should NOT trigger product search;
- brand/product combinations where one word could misroute the request.

Make the set diverse. At least:
- 35% multi-turn (2-4 turns);
- 20% STT/Irish/casual wording;
- 15% collision/misrouting traps;
- 10% questions where Cara must avoid inventing knowledge;
- 10% combined/multi-intent questions.

For each scenario return a STRUCTURED deterministic expectation that our grader can check. Do not require facts you cannot know (such as a specific live product price). Prefer checking routing/tool/intent/scope/query preservation/no-hallucination.

Allowed expectation fields:
summary: string
requiredTool: "searchSuperValuProducts"
forbiddenTools: string[]
requiredIntent: "offer" | "price" | "stock"
queryMustInclude: string[]
queryMustIncludeAny: string[]
forbiddenQueryTerms: string[]
requiredServiceArea: "butcher" | "deli" | "fish" | "produce" | "bakery" | "dairy" | "off_licence" | "grocery"
forbiddenServiceAreas: string[]
requiredFulfilment: "counter" | "prepack"
assistantMustIncludeAny: string[]
assistantMustNotInclude: string[]
mustAskClarifyingQuestion: boolean
lastTurnMustNotAskClarifyingQuestion: boolean
noError: boolean

Important grading rules:
- Product price/offer/stock/range questions should normally require searchSuperValuProducts and the matching intent.
- If the caller is genuinely ambiguous and Cara should clarify BEFORE searching, use mustAskClarifyingQuestion and DO NOT also require a product tool on that same unresolved one-turn scenario.
- Only use requiredServiceArea when the caller explicitly names a department/counter/aisle, or when the product-area mapping is unambiguous. Never label ordinary dairy products as grocery merely because they are sold in a supermarket.
- Only use requiredFulfilment when the caller explicitly says counter or pre-pack.
- Store knowledge such as hours, parking, toilets, ATM, delivery policy should forbid searchSuperValuProducts only when there is no genuine product request.
- Never encode an exact price/product answer unless the caller supplied that fact.
- Do not require generic words like "offer", "reduced", "deal", "stock" or "price" to remain inside the query when the structured intent already carries that meaning.
- DO preserve material promotion/ranking mechanics such as Rewards, multibuy, half price, a specific price point, cheapest/lowest price, or save-amount wording.
- Do not use assistantMustIncludeAny for style, dialect mirroring, or exact phrasing.
- Do not forbid lexical collision words such as "wine" in "red wine vinegar"; use forbiddenServiceAreas if the routing destination itself would be wrong.
- For combined intents such as price + stock, do not require one exact intent if either structured lookup can safely answer the request.
- Use lastTurnMustNotAskClarifyingQuestion only when the final caller turn fully and unambiguously selects the exact variant; otherwise omit it.
- A callback/team-check question is NOT a product-selection clarification.
- Do not repeat the same product/topic across many scenarios.

Return JSON only:
{
  "scenarios": [
    {
      "title": "short descriptive title",
      "category": "openings|products|prices|stock|offers|departments|knowledge|clarification|multi_turn|edge_cases",
      "tags": ["discovery", "..."],
      "turns": [{"caller":"..."}, {"caller":"..."}],
      "expectations": { ... }
    }
  ]
}

This is discovery batch ${input.batchIndex}. Novelty nonce: ${nonce}.`,
      },
      {
        role: "user",
        content:
          "Generate a fresh adversarial supermarket caller batch now. Do not explain your choices.",
      },
    ],
  });

  let parsed: { scenarios?: unknown };
  try {
    parsed = JSON.parse(raw) as { scenarios?: unknown };
  } catch {
    throw new Error("Discovery AI returned invalid JSON.");
  }

  if (!Array.isArray(parsed.scenarios)) {
    throw new Error("Discovery AI returned no scenarios.");
  }

  const seen = new Set<string>();
  const drafts: DiscoveryDraft[] = [];
  for (const value of parsed.scenarios) {
    const draft = sanitizeRetailDiscoveryDraft(value);
    if (!draft) continue;
    const key = normalizeConversation(draft);
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push(draft);
    if (drafts.length >= input.count) break;
  }

  if (drafts.length < Math.max(5, Math.floor(input.count * 0.75))) {
    throw new Error(
      `Discovery AI returned too few usable scenarios (${drafts.length}/${input.count}).`,
    );
  }

  return drafts.map((draft) => ({
    ...draft,
    discoveryKey: randomUUID(),
  }));
}
