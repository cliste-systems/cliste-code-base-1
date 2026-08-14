import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { VERTICAL_CHOICES, verticalPackForNiche } from "./verticals";

describe("retail live pack", () => {
  it("offers only retail in VERTICAL_CHOICES", () => {
    assert.deepEqual(
      VERTICAL_CHOICES.map((c) => c.id),
      ["retail"],
    );
  });

  it("maps niche retail to the Store pack", () => {
    const pack = verticalPackForNiche("retail");
    assert.equal(pack.id, "retail");
    assert.equal(pack.productNoun, "Store");
    assert.equal(pack.customerNoun.plural, "customers");
    assert.equal(pack.nav?.labelOverrides?.["/dashboard"], "Knowledge Gaps");
  });

  it("keeps salon machinery without offering it as a choice", () => {
    const pack = verticalPackForNiche("hair_salon");
    assert.equal(pack.id, "salon_beauty");
    assert.equal(pack.productNoun, "Salon");
  });
});
