import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRetailDiscoveryPlan,
  buildRetailDiscoveryScenarioDraft,
  type RetailDiscoveryGeneratedItem,
} from "@/lib/retail-discovery";
import { gradeRetailRegressionScenario } from "@/lib/retail-regression";

function generated(
  slot: number,
  overrides?: Partial<RetailDiscoveryGeneratedItem>,
): RetailDiscoveryGeneratedItem {
  return {
    slot,
    title: "Fresh stress case",
    turns: ["Hiya, any odd product on offer?"],
    queryTerms: ["odd product"],
    ...overrides,
  };
}

test("discovery plan caps batches at 20 and rotates across failure profiles", () => {
  const plan = buildRetailDiscoveryPlan(0, 20);
  assert.equal(plan.length, 20);
  assert.ok(new Set(plan.map((entry) => entry.profile)).size >= 10);
  assert.equal(buildRetailDiscoveryPlan(4, 99).length, 20);
});

test("department discovery builds deterministic service-area expectations", () => {
  const plan = {
    slot: 0,
    profile: "department_scope" as const,
    intent: "offer" as const,
    serviceArea: "fish" as const,
  };

  const scenario = buildRetailDiscoveryScenarioDraft(
    plan,
    generated(0, {
      turns: ["Anything on offer at the fish counter in hake?"],
      queryTerms: ["hake"],
    }),
  );

  assert.equal(scenario.category, "departments");
  assert.equal(scenario.expectations.requiredTool, "searchSuperValuProducts");
  assert.equal(scenario.expectations.requiredIntent, "offer");
  assert.equal(scenario.expectations.requiredServiceArea, "fish");
  assert.deepEqual(scenario.expectations.queryMustIncludeAny, ["hake"]);
  assert.ok(scenario.tags.includes("discovery-family:department_scope"));
});

test("explicit fulfilment discovery hard-requires counter or prepack", () => {
  const scenario = buildRetailDiscoveryScenarioDraft(
    {
      slot: 0,
      profile: "explicit_fulfilment",
      intent: "offer",
      serviceArea: "butcher",
      fulfilment: "counter",
    },
    generated(0, {
      turns: ["What lamb deals have ye at the butcher counter?"],
      queryTerms: ["lamb"],
    }),
  );

  assert.equal(scenario.expectations.requiredServiceArea, "butcher");
  assert.equal(scenario.expectations.requiredFulfilment, "counter");
});

test("Rewards discovery preserves exact price-point semantics", () => {
  const scenario = buildRetailDiscoveryScenarioDraft(
    {
      slot: 0,
      profile: "rewards_price",
      intent: "offer",
      rewardsAmount: "3.00",
    },
    generated(0, {
      turns: ["Anything on Rewards Price for €3.00?"],
      queryTerms: ["rewards"],
    }),
  );

  assert.equal(scenario.expectations.requiredIntent, "offer");
  assert.deepEqual(scenario.expectations.queryMustInclude, ["rewards", "3.00"]);
  assert.match(scenario.expectations.summary, /€3\.00/);
});

test("decisive refinement requires two turns and forbids another selection question", () => {
  const plan = {
    slot: 0,
    profile: "decisive_refinement" as const,
    intent: "price" as const,
  };

  assert.throws(
    () =>
      buildRetailDiscoveryScenarioDraft(
        plan,
        generated(0, {
          turns: ["How much is that sauce?"],
          queryTerms: ["sauce"],
        }),
      ),
    /at least 2 caller turns/i,
  );

  const scenario = buildRetailDiscoveryScenarioDraft(
    plan,
    generated(0, {
      turns: [
        "How much is that Ballymaloe sauce?",
        "The relish one, the big jar.",
      ],
      queryTerms: ["ballymaloe", "relish"],
    }),
  );

  assert.equal(
    scenario.expectations.lastTurnMustNotAskClarifyingQuestion,
    true,
  );
});

test("ambiguity discovery is graded as clarification rather than a forced lookup", () => {
  const scenario = buildRetailDiscoveryScenarioDraft(
    {
      slot: 0,
      profile: "ambiguity_clarification",
    },
    generated(0, {
      turns: ["Any salmon on offer?"],
      queryTerms: [],
    }),
  );

  assert.equal(scenario.category, "clarification");
  assert.equal(scenario.expectations.mustAskClarifyingQuestion, true);
  assert.equal(scenario.expectations.requiredTool, undefined);
});


test("generated fulfilment scenario grades through the normal regression evaluator", () => {
  const scenario = buildRetailDiscoveryScenarioDraft(
    {
      slot: 0,
      profile: "explicit_fulfilment",
      intent: "offer",
      serviceArea: "fish",
      fulfilment: "counter",
    },
    generated(0, {
      turns: ["Any hake deals at the fish counter?"],
      queryTerms: ["hake"],
    }),
  );

  const grade = gradeRetailRegressionScenario(
    { expectations: scenario.expectations },
    {
      durationMs: 100,
      turns: [
        {
          caller: scenario.turns[0]!.caller,
          assistant: "I checked the fresh fish counter hake offers.",
          transcriptLines: [],
          tools: [
            {
              name: "searchSuperValuProducts",
              args: {
                intent: "offer",
                query: "hake",
                service_area: "fish",
                fulfilment: "counter",
              },
            },
          ],
        },
      ],
    },
  );

  assert.equal(grade.status, "pass");
});

test("generated ambiguity scenario passes only for a real selection clarification", () => {
  const scenario = buildRetailDiscoveryScenarioDraft(
    { slot: 0, profile: "ambiguity_clarification" },
    generated(0, {
      turns: ["Any salmon on offer?"],
      queryTerms: [],
    }),
  );

  const good = gradeRetailRegressionScenario(
    { expectations: scenario.expectations },
    {
      durationMs: 100,
      turns: [
        {
          caller: scenario.turns[0]!.caller,
          assistant: "Do you mean the fresh fish counter or the pre-packed salmon?",
          transcriptLines: [],
          tools: [],
        },
      ],
    },
  );
  assert.equal(good.status, "pass");

  const bad = gradeRetailRegressionScenario(
    { expectations: scenario.expectations },
    {
      durationMs: 100,
      turns: [
        {
          caller: scenario.turns[0]!.caller,
          assistant: "Would you like me to get the team to ring you back?",
          transcriptLines: [],
          tools: [],
        },
      ],
    },
  );
  assert.equal(bad.status, "fail");
});
