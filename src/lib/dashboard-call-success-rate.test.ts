import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeCallSuccessRate } from "./dashboard-call-success-rate";

describe("computeCallSuccessRate blocked exclusion", () => {
  it("excludes blocked calls from eligible count", () => {
    const result = computeCallSuccessRate(["answered", "blocked", "failed"]);
    assert.equal(result.eligibleCount, 2);
    assert.equal(result.percent, 50);
  });
});
