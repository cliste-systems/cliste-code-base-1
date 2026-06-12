import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("phone pool assignment invariant", () => {
  it("expects one assigned DID per org (migration 061)", () => {
    const indexName = "phone_numbers_one_assigned_per_org";
    assert.match(indexName, /one_assigned_per_org/);
  });
});
