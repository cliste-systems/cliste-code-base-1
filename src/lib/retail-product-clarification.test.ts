import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBroadProductClarificationHint,
  buildOfferFulfilmentClarificationHint,
  buildProductClarificationHint,
  filterOfferMatchesByInferredFulfilment,
  isBroadProductQuery,
  resolveProductSearchResponse,
} from "./retail-product-clarification";

describe("retail product clarification", () => {
  it("treats single-word category queries as broad", () => {
    assert.equal(isBroadProductQuery("mushrooms"), true);
    assert.equal(isBroadProductQuery("weekly offers"), true);
    assert.equal(isBroadProductQuery("Carrolls crumbed ham"), false);
  });

  it("asks counter vs pre-pack before quoting mixed offer matches", () => {
    const hint = buildOfferFulfilmentClarificationHint([
      {
        product_name: "Loose Side of Salmon (700 g)",
        service_area: "fish",
        fulfilment: "counter",
      },
      {
        product_name: "SuperValu Cajun Salmon Darnes (220 g)",
        service_area: "fish",
        fulfilment: "prepack",
      },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /counter and pre-pack/i);
    assert.match(hint ?? "", /Do not quote a specific price/i);
  });

  it("prefers fulfilment clarification over brand clarification", () => {
    const hint = buildProductClarificationHint("salmon darnes on offer", [
      {
        product_name: "Loose Side of Salmon (700 g)",
        service_area: "fish",
        fulfilment: "counter",
      },
      {
        product_name: "SuperValu Cajun Salmon Darnes (220 g)",
        service_area: "fish",
        fulfilment: "prepack",
      },
      {
        product_name: "Keohane's Salmon Fillets (480 g)",
        service_area: "fish",
        fulfilment: "prepack",
      },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /counter and pre-pack/i);
  });

  it("skips fulfilment clarification when caller already chose counter", () => {
    const matches = [
      {
        product_name: "Loose Side of Salmon (700 g)",
        service_area: "fish",
        fulfilment: "counter",
        quote_text: "At the fish counter this week — fifteen euro ninety nine per kilo",
      },
      {
        product_name: "SuperValu Cajun Salmon Darnes (220 g)",
        service_area: "fish",
        fulfilment: "prepack",
        quote_text: "In the pre-pack fish aisle this week — four euro forty nine",
      },
    ];
    const response = resolveProductSearchResponse("loose salmon counter", matches);
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.equal(response.matches[0]?.fulfilment, "counter");
    assert.match(response.matches[0]?.quote_text ?? "", /per kilo/i);
  });

  it("filters to counter matches when query mentions fish counter", () => {
    const filtered = filterOfferMatchesByInferredFulfilment("fish counter salmon", [
      {
        product_name: "Loose Side of Salmon (700 g)",
        fulfilment: "counter",
      },
      {
        product_name: "Keohane's Salmon Fillets (480 g)",
        fulfilment: "prepack",
      },
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.fulfilment, "counter");
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
