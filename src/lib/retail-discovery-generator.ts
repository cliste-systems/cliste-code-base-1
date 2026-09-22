import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import {
  buildRetailDiscoveryPlan,
  buildRetailDiscoveryScenarioDraft,
  type RetailDiscoveryGeneratedItem,
  type RetailDiscoveryPlanEntry,
  type RetailDiscoveryScenarioDraft,
} from "@/lib/retail-discovery";

function profileInstruction(plan: RetailDiscoveryPlanEntry): string {
  const intent = plan.intent ? ` Final/required intent: ${plan.intent}.` : "";
  const area = plan.serviceArea ? ` Explicit service area: ${plan.serviceArea}.` : "";
  const fulfilment = plan.fulfilment ? ` Explicit fulfilment: ${plan.fulfilment}.` : "";

  switch (plan.profile) {
    case "lexical_collision":
      return `Use a real/plausible NON-ALCOHOL supermarket product whose name contains a misleading word that could trigger the wrong department (but do not reuse wine gums, cider vinegar, beer-battered cod or Cadbury Dairy Milk). Make the intended product identity obvious enough for a human.${intent}`;
    case "department_scope":
      return `Caller explicitly names the ${plan.serviceArea} area/department and asks about a product or browse there. The area must matter to the request.${intent}${area}`;
    case "explicit_fulfilment":
      return `Caller explicitly chooses ${plan.fulfilment} in the ${plan.serviceArea} area. Use wording a real Irish supermarket caller would use, not technical API words unless natural.${intent}${area}${fulfilment}`;
    case "rewards_price":
      return `Caller asks for Real Rewards/Rewards Price offers at exactly €${plan.rewardsAmount}. The numeric amount ${plan.rewardsAmount} must appear literally in the caller wording. Do not ask for a particular product.`;
    case "context_switch":
      return `Two turns. Turn 1 establishes one product and a DIFFERENT intent. Turn 2 explicitly changes the request so the final intent is ${plan.intent}; preserve the same product identity across turns.`;
    case "decisive_refinement":
      return `Two turns. Turn 1 is genuinely ambiguous about a product/type. Turn 2 decisively selects the product/type/brand/size and asks for ${plan.intent}; after turn 2 no further selection question should be needed.`;
    case "ambiguity_clarification":
      return "One turn that is genuinely ambiguous between two plausible product/fulfilment choices and should trigger ONE short selection clarification rather than a guessed answer. Do not already resolve the ambiguity in the caller wording.";
    case "irish_stt":
      return `One turn with natural Irish/Donegal-style speech or realistic speech-to-text noise/typo-lite. It must still have a recoverable product identity and ${plan.intent} intent. Avoid cartoonish dialect spelling.`;
    case "brand_size":
      return `One turn naming a specific brand + product + size/pack detail and asking for ${plan.intent}. The important identity details should survive the lookup.`;
    case "vague_followup":
      return `Two turns. Turn 1 clearly establishes a product/category. Turn 2 uses a vague reference like "the cheapest one", "the big packet", "that one", or similar, while the final intent is ${plan.intent}. The second turn depends on memory of turn 1.`;
    case "mind_change":
      return `Three turns. Caller starts with one request, changes direction in turn 2, then makes a final clear request in turn 3 with final intent ${plan.intent}. The final turn should override stale context without becoming nonsense.`;
    case "multi_question":
      return `One natural sentence containing multiple details/questions around one product, with ${plan.intent} as the core lookup intent. Make it awkward but realistic, not a test-script sentence.`;
    case "unusual_product":
      return `One turn asking whether the shop carries an unusual but plausible supermarket product. Final intent is ${plan.intent}. It should force a catalogue lookup instead of common-sense guessing.`;
  }
}

export async function generateRetailDiscoveryBatch(input: {
  batchIndex: number;
  count: number;
  avoidExamples?: string[];
}): Promise<RetailDiscoveryScenarioDraft[]> {
  const plan = buildRetailDiscoveryPlan(input.batchIndex, input.count);
  const avoid = (input.avoidExamples ?? [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(-40);

  const slotGuide = plan
    .map(
      (entry) =>
        `SLOT ${entry.slot} — PROFILE ${entry.profile}: ${profileInstruction(entry)}`,
    )
    .join("\n");

  const raw = await completeOpenRouterChat({
    temperature: 0.95,
    maxTokens: 12000,
    messages: [
      {
        role: "system",
        content: `You generate adversarial discovery tests for HelloCara, an Irish supermarket phone assistant.

Goal: find NEW failure modes, not repeat a canned regression suite. Produce realistic callers who may be vague, hurried, colloquial, awkward, typo/STT affected, change their mind, or use misleading product names.

Return strict JSON only:
{
  "scenarios": [
    {
      "slot": 0,
      "title": "short diagnostic title",
      "turns": ["caller turn 1", "optional turn 2", "optional turn 3"],
      "queryTerms": ["important product identity term or phrase"]
    }
  ]
}

Hard rules:
- Return exactly one scenario for every requested slot, no extra slots.
- title describes the failure pressure, not the expected answer.
- turns are ONLY what the caller says. Never write Cara's response.
- queryTerms are 1-4 short lowercase terms/phrases that the product lookup should preserve from the caller's intended product. Do not put generic words like offer, price, stock, shop, please, cheapest, one.
- For multi-turn cases, queryTerms describe the FINAL product context that should reach the tool.
- Use actual/plausible Irish supermarket products/categories, not fantastical nonsense.
- Vary brands, products, departments, wording and sentence shape across the batch.
- Do not deliberately copy the examples listed below.
- Do not mention APIs, tools, test cases, service_area, fulfilment, or being an AI.
- Natural Irish wording is welcome ("ye", "hiya", "would ye have", "what's the craic with") but keep it believable and varied.
- STT noise should be recoverable, not random gibberish.
- When a slot specifies an exact Rewards amount, preserve that exact numeric amount in the caller turn.
- When a slot specifies an explicit area/counter/pre-pack choice, the caller wording itself must state that choice naturally.
- For ambiguity_clarification, queryTerms may be empty; every other profile needs useful queryTerms.

Requested slots:
${slotGuide}

Avoid repeating these recent caller openings:
${avoid.length ? avoid.map((line) => `- ${line}`).join("\n") : "- none provided"}`,
      },
      {
        role: "user",
        content: `Generate this batch of ${plan.length} discovery scenarios now.`,
      },
    ],
  });

  let parsed: { scenarios?: unknown };
  try {
    parsed = JSON.parse(raw) as { scenarios?: unknown };
  } catch {
    throw new Error("Discovery generator returned invalid JSON.");
  }

  if (!Array.isArray(parsed.scenarios)) {
    throw new Error("Discovery generator returned no scenarios array.");
  }

  const bySlot = new Map<number, RetailDiscoveryGeneratedItem>();
  for (const value of parsed.scenarios) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const slot = Number(row.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= plan.length) continue;
    const title = typeof row.title === "string" ? row.title : "";
    const turns = Array.isArray(row.turns)
      ? row.turns.filter((item): item is string => typeof item === "string")
      : [];
    const queryTerms = Array.isArray(row.queryTerms)
      ? row.queryTerms.filter((item): item is string => typeof item === "string")
      : [];
    bySlot.set(slot, { slot, title, turns, queryTerms });
  }

  const drafts = plan.map((entry) => {
    const generated = bySlot.get(entry.slot);
    if (!generated) {
      throw new Error(`Discovery generator omitted slot ${entry.slot}.`);
    }
    return buildRetailDiscoveryScenarioDraft(entry, generated);
  });

  if (drafts.length !== plan.length) {
    throw new Error("Discovery generator returned an incomplete batch.");
  }

  return drafts;
}
