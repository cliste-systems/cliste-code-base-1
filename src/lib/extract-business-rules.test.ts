import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fallbackBusinessRules } from "./extract-business-rules-fallback";

describe("extract-business-rules fallback", () => {
  it("splits a comma-style paragraph into multiple rules", () => {
    const rules = fallbackBusinessRules(
      "48 hours notice to cancel; deposit needed for colour; no walk-ins on Saturdays.",
    );

    assert.equal(rules.length, 3);
    assert.match(rules[0]!, /48 hours notice/i);
    assert.match(rules[1]!, /deposit/i);
    assert.match(rules[2]!, /walk-ins/i);
  });

  it("preserves newline-separated rules", () => {
    const rules = fallbackBusinessRules(
      "Never quote prices on the phone\nAlways take a message if unsure",
    );

    assert.deepEqual(rules, [
      "Never quote prices on the phone",
      "Always take a message if unsure",
    ]);
  });

  it("returns empty for blank input", () => {
    assert.deepEqual(fallbackBusinessRules(""), []);
    assert.deepEqual(fallbackBusinessRules("   "), []);
  });
});
