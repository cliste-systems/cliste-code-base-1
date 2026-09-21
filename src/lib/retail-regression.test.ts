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
