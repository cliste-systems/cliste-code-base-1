import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyRulePolarity,
  normalizeRuleForPolarity,
  partitionRulesByPolarity,
} from "./rule-polarity";

describe("rule-polarity", () => {
  it("classifies negative policies as dont", () => {
    assert.equal(
      classifyRulePolarity("Never quote a price over the phone"),
      "dont",
    );
    assert.equal(classifyRulePolarity("we don't do discounts"), "dont");
    assert.equal(
      classifyRulePolarity("Don't book new clients on Mondays"),
      "dont",
    );
  });

  it("classifies positive style notes as do", () => {
    assert.equal(
      classifyRulePolarity("Use their first name when you have it"),
      "do",
    );
    assert.equal(classifyRulePolarity("Keep answers short"), "do");
    assert.equal(
      classifyRulePolarity("Always take a message if unsure"),
      "do",
    );
  });

  it("normalizes dont-column adds with a negation cue", () => {
    assert.equal(
      normalizeRuleForPolarity("quote on the phone", "dont"),
      "Don't quote on the phone",
    );
    assert.equal(
      normalizeRuleForPolarity("Never quote a price over the phone", "dont"),
      "Never quote a price over the phone",
    );
  });

  it("partitions a mixed list", () => {
    const partitioned = partitionRulesByPolarity([
      "Keep answers short",
      "Never quote a price over the phone",
      "Use their first name",
    ]);
    assert.deepEqual(partitioned.do, [
      "Keep answers short",
      "Use their first name",
    ]);
    assert.deepEqual(partitioned.dont, ["Never quote a price over the phone"]);
  });
});
