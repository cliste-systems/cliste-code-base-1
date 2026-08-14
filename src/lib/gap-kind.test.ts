import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyGapKind, parseCaraTrainingGapKind } from "./gap-kind";

describe("classifyGapKind", () => {
  it("treats stock and live price questions as live_info", () => {
    assert.equal(classifyGapKind("Do you have milk in stock?"), "live_info");
    assert.equal(classifyGapKind("Have you got the 2-for-1 mince?"), "live_info");
    assert.equal(classifyGapKind("How much is the chicken?"), "live_info");
    assert.equal(classifyGapKind("What are today's specials?"), "live_info");
    assert.equal(classifyGapKind("Are you open now?"), "live_info");
    assert.equal(classifyGapKind("How busy is the deli queue?"), "live_info");
  });

  it("treats policies, hours schedule, and departments as learnable", () => {
    assert.equal(
      classifyGapKind("What are your opening hours on Sunday?"),
      "learnable",
    );
    assert.equal(classifyGapKind("Do you have a butcher counter?"), "learnable");
    assert.equal(
      classifyGapKind("Can you accept click and collect after 6?"),
      "learnable",
    );
    assert.equal(classifyGapKind("Do you sell lottery tickets?"), "learnable");
  });

  it("defaults unknown / empty to learnable", () => {
    assert.equal(classifyGapKind(""), "learnable");
    assert.equal(parseCaraTrainingGapKind("nope"), "learnable");
    assert.equal(parseCaraTrainingGapKind("live_info"), "live_info");
  });
});
