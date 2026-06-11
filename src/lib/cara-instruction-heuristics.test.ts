import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tryParseTemporaryUnavailabilityRule } from "./cara-instruction-heuristics";

describe("tryParseTemporaryUnavailabilityRule", () => {
  it("routes temporary booking pauses to a business rule", () => {
    const parsed = tryParseTemporaryUnavailabilityRule(
      "tell Cara we're not taking consultation bookings until next month",
    );
    assert.ok(parsed);
    assert.match(parsed!.rule, /Do not book consultation/i);
    assert.match(parsed!.rule, /next month/i);
    assert.doesNotMatch(parsed!.rule, /servicesNotOffered/i);
  });

  it("returns null for unrelated instructions", () => {
    assert.equal(
      tryParseTemporaryUnavailabilityRule("we open at 9am on Mondays"),
      null,
    );
  });
});
