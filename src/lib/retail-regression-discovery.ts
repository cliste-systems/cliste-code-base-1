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
  const cleaned = [...new Set(
    value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean),
  )].slice(0, max);
  return cleaned.length ? cleaned : undefined;
}

function sanitizeExpectations(value: unknown): RetailRegressionExpectation {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim().slice(0, 300)
      : "Cara should handle this caller scenario safely and without inventing facts.";

  const expectation: RetailRegressionExpectation = {
    summary,
    noError: raw.noError !== false,
  };

  if (raw.requiredTool === "searchSuperValuProducts") {
    expectation.requiredTool = "searchSuperValuProducts";
  }
  const forbiddenTools = cleanStringList(raw.forbiddenTools, 5);
  if (forbiddenTools) expectation.forbiddenTools = forbiddenTools;

  if (["offer", "price", "stock"].includes(String(raw.requiredIntent ?? ""))) {
    expectation.requiredIntent = String(raw.requiredIntent);
  }

  for (const key of [
    "queryMustInclude",
    "queryMustIncludeAny",
    "forbiddenQueryTerms",
    "forbiddenServiceAreas",
    "assistantMustIncludeAny",
    "assistantMustNotInclude",
  ] as const) {
    const list = cleanStringList(raw[key], 8);
    if (list) expectation[key] = list;
  }

  const serviceArea = String(raw.requiredServiceArea ?? "");
  if (ALLOWED_SERVICE_AREAS.has(serviceArea)) {
    expectation.requiredServiceArea = serviceArea;
  }

  const fulfilment = String(raw.requiredFulfilment ?? "");
  if (ALLOWED_FULFILMENT.has(fulfilment)) {
    expectation.requiredFulfilment = fulfilment as "counter" | "prepack";
  }

  if (raw.mustAskClarifyingQuestion === true) {
    expectation.mustAskClarifyingQuestion = true;
  }
  if (raw.lastTurnMustNotAskClarifyingQuestion === true) {
    expectation.lastTurnMustNotAskClarifyingQuestion = true;
  }

  return expectation;
}

function sanitizeDraft(value: unknown): DiscoveryDraft | null {
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

  const categoryRaw = String(raw.category ?? "edge_cases") as RetailRegressionCategory;
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
    expectations: sanitizeExpectations(raw.expectations),
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
- Explicit store areas should use requiredServiceArea.
- Explicit counter/pre-pack should use requiredFulfilment.
- Genuine ambiguity may use mustAskClarifyingQuestion instead of forcing a scope.
- Store knowledge such as hours, parking, toilets, ATM, delivery policy should forbid searchSuperValuProducts unless the question also genuinely includes a product request.
- Never encode an exact price/product answer unless the caller supplied that fact.
- Query expectations must be tolerant: use queryMustIncludeAny for synonyms/likely reformulations.
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
    const draft = sanitizeDraft(value);
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
