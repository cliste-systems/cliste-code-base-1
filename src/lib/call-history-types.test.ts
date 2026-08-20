import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeCallOutcome } from "./call-history-types";

describe("normalizeCallOutcome blocked", () => {
  it("maps blocked canonical values", () => {
    assert.equal(normalizeCallOutcome("blocked"), "blocked");
    assert.equal(normalizeCallOutcome("caller_blocked"), "blocked");
    assert.equal(normalizeCallOutcome("Rejected by blocklist"), "blocked");
  });
});

describe("normalizeCallOutcome transferred", () => {
  it("maps transfer canonical values", () => {
    assert.equal(normalizeCallOutcome("transferred"), "transferred");
    assert.equal(normalizeCallOutcome("transfer"), "transferred");
    assert.equal(normalizeCallOutcome("Caller was forwarded to deli"), "transferred");
  });
});
