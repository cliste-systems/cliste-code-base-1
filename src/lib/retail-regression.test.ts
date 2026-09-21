import assert from "node:assert/strict";
import test from "node:test";

import { buildDefaultRetailRegressionScenarios } from "@/lib/retail-regression-library";
import {
  classifyRegressionFailure,
  gradeRetailRegressionScenario,
  type RetailRegressionExecution,
} from "@/lib/retail-regression";

test("built-in retail regression suite contains exactly 200 unique scenarios", () => {
  const scenarios = buildDefaultRetailRegressionScenarios();
  assert.equal(scenarios.length, 200);
  assert.equal(new Set(scenarios.map((scenario) => scenario.slug)).size, 200);
  assert.ok(scenarios.some((scenario) => scenario.turns.length > 1));
});

test("wine gums passes when product intent is preserved", () => {
  const scenario = buildDefaultRetailRegressionScenarios().find((row) =>
    row.slug.startsWith("wine-gums-offer-"),
  );
  assert.ok(scenario);

  const execution: RetailRegressionExecution = {
    durationMs: 120,
    turns: [
      {
        caller: scenario.turns[0]!.caller,
        assistant: "Yes — Maynards wine gums have a Rewards offer.",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "offer", query: "Maynards wine gums" },
          },
        ],
      },
    ],
  };

  assert.deepEqual(gradeRetailRegressionScenario(scenario, execution), {
    status: "pass",
    reasons: [],
    failureSignature: null,
  });
});

test("wine gums fails if routed to off licence", () => {
  const scenario = buildDefaultRetailRegressionScenarios().find((row) =>
    row.slug.startsWith("wine-gums-offer-"),
  );
  assert.ok(scenario);

  const grade = gradeRetailRegressionScenario(scenario, {
    durationMs: 120,
    turns: [
      {
        caller: scenario.turns[0]!.caller,
        assistant: "Let me check.",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: {
              intent: "offer",
              query: "wine gums",
              serviceArea: "off_licence",
            },
          },
        ],
      },
    ],
  });

  assert.equal(grade.status, "fail");
  assert.match(grade.reasons.join(" "), /forbidden service area/i);
  assert.ok(grade.failureSignature);
});

test("intent switch scenario requires a stock lookup", () => {
  const scenario = buildDefaultRetailRegressionScenarios().find((row) =>
    row.slug.startsWith("cereal-to-weetabix-"),
  );
  assert.ok(scenario);

  const grade = gradeRetailRegressionScenario(scenario, {
    durationMs: 300,
    turns: [
      {
        caller: scenario.turns[0]!.caller,
        assistant: "There are a few cereal offers.",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "offer", query: "cereal" },
          },
        ],
      },
      {
        caller: scenario.turns[1]!.caller,
        assistant: "Weetabix is listed in the range.",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "stock", query: "Weetabix" },
          },
        ],
      },
    ],
  });

  assert.equal(grade.status, "pass");
});

test("service-area expectations use the effective backend scope from the product query", () => {
  const wineScenario = buildDefaultRetailRegressionScenarios().find((row) =>
    row.slug.startsWith("wine-offer-"),
  );
  assert.ok(wineScenario);
  const grade = gradeRetailRegressionScenario(wineScenario, {
    durationMs: 100,
    turns: [
      {
        caller: wineScenario.turns[0]!.caller,
        assistant: "There are wine offers; you must be 18 or over.",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "offer", query: "wine" },
          },
        ],
      },
    ],
  });
  assert.equal(grade.status, "pass");
});

test("counter scenarios require the structured fulfilment choice", () => {
  const scenario = buildDefaultRetailRegressionScenarios().find((row) =>
    row.slug.startsWith("salmon-fish-counter-"),
  );
  assert.ok(scenario);

  const missing = gradeRetailRegressionScenario(scenario, {
    durationMs: 100,
    turns: [
      {
        caller: scenario.turns[0]!.caller,
        assistant: "Do you mean the counter or pre-pack?",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "offer", query: "salmon" },
          },
        ],
      },
    ],
  });
  assert.equal(missing.status, "fail");
  assert.match(missing.reasons.join(" "), /fulfilment "counter"/i);

  const correct = gradeRetailRegressionScenario(scenario, {
    durationMs: 100,
    turns: [
      {
        caller: scenario.turns[0]!.caller,
        assistant: "I checked the fresh counter salmon offers.",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "offer", query: "salmon", fulfilment: "counter" },
          },
        ],
      },
    ],
  });
  assert.equal(correct.status, "pass");
});

test("cheapest refinement fails if Cara asks another clarification", () => {
  const scenario = buildDefaultRetailRegressionScenarios().find((row) =>
    row.slug.startsWith("avocado-refinement-"),
  );
  assert.ok(scenario);
  const grade = gradeRetailRegressionScenario(scenario, {
    durationMs: 200,
    turns: [
      {
        caller: scenario.turns[0]!.caller,
        assistant: "Which type of avocado?",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "price", query: "avocado" },
          },
        ],
      },
      {
        caller: scenario.turns[1]!.caller,
        assistant: "Would you like mini Hass or the ripe avocados?",
        transcriptLines: [],
        tools: [
          {
            name: "searchSuperValuProducts",
            args: { intent: "price", query: "cheapest SuperValu avocado" },
          },
        ],
      },
    ],
  });
  assert.equal(grade.status, "fail");
  assert.match(grade.reasons.join(" "), /decisive selection/i);
});

test("recurrence classifier distinguishes new, recurring, and returned regressions", () => {
  assert.deepEqual(
    classifyRegressionFailure({
      currentStatus: "fail",
      currentFailureSignature: "wrong route",
      prior: [],
    }),
    { issueKind: "new_failure", occurrenceCount: 1 },
  );

  assert.deepEqual(
    classifyRegressionFailure({
      currentStatus: "fail",
      currentFailureSignature: "wrong route",
      prior: [{ status: "fail", failureSignature: "wrong route" }],
    }),
    { issueKind: "recurring", occurrenceCount: 2 },
  );

  assert.deepEqual(
    classifyRegressionFailure({
      currentStatus: "fail",
      currentFailureSignature: "wrong route",
      prior: [
        { status: "pass", failureSignature: null },
        { status: "fail", failureSignature: "wrong route" },
      ],
    }),
    { issueKind: "regression_returned", occurrenceCount: 2 },
  );

  assert.deepEqual(
    classifyRegressionFailure({
      currentStatus: "pass",
      currentFailureSignature: null,
      prior: [{ status: "fail", failureSignature: "wrong route" }],
    }),
    { issueKind: null, occurrenceCount: 0 },
  );
});
