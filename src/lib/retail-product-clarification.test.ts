import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBroadProductClarificationHint,
  isBroadProductQuery,
} from "./retail-product-clarification";

describe("retail product clarification", () => {
  it("treats single-word category queries as broad", () => {
    assert.equal(isBroadProductQuery("mushrooms"), true);
    assert.equal(isBroadProductQuery("weekly offers"), false);
    assert.equal(isBroadProductQuery("Carrolls crumbed ham"), false);
  });

  it("builds a clarify-first hint for diverse mushroom matches", () => {
    const hint = buildBroadProductClarificationHint("mushrooms", [
      { productName: "SuperValu Chestnut Mushrooms (200 g)" },
      { productName: "SuperValu Irish Baby Button Mushrooms (150 g)" },
      { productName: "Merlini Dried Porcini Mushrooms (20 g)" },
      { productName: "SuperValu Breaded Garlic Mushrooms (320 g)" },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /clarifying question/i);
    assert.match(hint ?? "", /Chestnut|Button|Porcini/i);
    assert.doesNotMatch(hint ?? "", /€/);
  });

  it("does not clarify specific brand queries", () => {
    const hint = buildBroadProductClarificationHint("greenfarm turkey slices", [
      { productName: "Green Farm Delicatessen Roasted & Carved Turkey Slices (120 g)" },
      { productName: "Green Farm Roast Turkey Breast Slices (90 g)" },
    ]);
    assert.equal(hint, null);
  });
});
