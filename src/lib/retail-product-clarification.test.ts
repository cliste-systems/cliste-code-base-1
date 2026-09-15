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
    assert.match(hint ?? "", /fresh at the fish counter/i);
    assert.match(hint ?? "", /pre-pack packs in the fish aisle/i);
    assert.match(hint ?? "", /Do not quote a specific price/i);
  });

  it("prefers fulfilment clarification over brand clarification", () => {
    const hint = buildProductClarificationHint("salmon on offer", [
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
    assert.match(hint ?? "", /fresh at the/i);
    assert.match(hint ?? "", /pre-pack/i);
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

  it("does not clarify counter vs pre-pack across different service areas", () => {
    const hint = buildOfferFulfilmentClarificationHint([
      {
        product_name: "Horgans Sliced Corned Beef (120 g)",
        service_area: "deli",
        fulfilment: "prepack",
      },
      {
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        service_area: "butcher",
        fulfilment: "counter",
      },
    ]);
    assert.equal(hint, null);
  });

  it("returns Horgans corned beef without blocking clarification", () => {
    const response = resolveProductSearchResponse("corned beef", [
      {
        product_name: "Horgans Sliced Corned Beef (120 g)",
        service_area: "deli",
        fulfilment: "prepack",
        quote_text: "At the deli counter this week — Horgans Sliced Corned Beef (120 g) is on offer this week at three euro",
      },
      {
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        service_area: "butcher",
        fulfilment: "counter",
        quote_text: "At the butcher counter this week — sirloin",
      },
    ]);
    assert.equal(response.clarificationHint, null);
    assert.equal(response.matches.length, 1);
    assert.match(response.matches[0]?.product_name ?? "", /Horgans/i);
  });

  it("does not clarify specific brand queries", () => {
    const hint = buildBroadProductClarificationHint("greenfarm turkey slices", [
      { productName: "Green Farm Delicatessen Roasted & Carved Turkey Slices (120 g)" },
      { productName: "Green Farm Roast Turkey Breast Slices (90 g)" },
    ]);
    assert.equal(hint, null);
  });

  it("keeps steak offer matches when broad clarification is needed", () => {
    const response = resolveProductSearchResponse("steaks", [
      {
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        service_area: "butcher",
        fulfilment: "counter",
        quote_text: "At the butcher counter this week — sirloin steak",
      },
      {
        product_name: "SuperValu Signature Tastes Hereford Beef Irish Striploin Steak (450 g)",
        service_area: "butcher",
        fulfilment: "prepack",
        quote_text: "In the pre-pack meat aisle this week — striploin steak",
      },
      {
        product_name: "SuperValu Salt & Chilli Beef Quick Fry Steaks (380 g)",
        service_area: "butcher",
        fulfilment: "prepack",
        quote_text: "In the pre-pack meat aisle this week — quick fry steaks",
      },
    ]);
    assert.ok(response.clarificationHint);
    assert.equal(response.matches.length, 3);
    assert.match(response.matches[0]?.product_name ?? "", /Sirloin/i);
    assert.match(response.clarificationHint ?? "", /butcher counter/i);
    assert.match(response.clarificationHint ?? "", /pre-pack/i);
  });

  it("asks counter vs pre-pack for broad deli ham offers", () => {
    const response = resolveProductSearchResponse("ham on offer", [
      {
        product_name: "SuperValu Traditional Cooked Ham (1 kg)",
        service_area: "deli",
        fulfilment: "counter",
        quote_text: "At the deli counter this week — cooked ham per kilo",
      },
      {
        product_name: "Horgans Sliced Cooked Ham (120 g)",
        service_area: "deli",
        fulfilment: "prepack",
        quote_text: "In the chilled pre-pack deli this week — sliced ham",
      },
    ]);
    assert.ok(response.clarificationHint);
    assert.match(response.clarificationHint ?? "", /deli counter/i);
    assert.match(response.clarificationHint ?? "", /pre-pack/i);
    assert.equal(response.matches.length, 2);
  });

  it("asks counter vs pre-pack for broad fish offers", () => {
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
    assert.match(hint ?? "", /fish counter/i);
  });

  it("clarifies broad ambient grocery offers by product type", () => {
    const hint = buildBroadProductClarificationHint("biscuits", [
      { productName: "McVitie's Hobnobs Milk Chocolate Biscuits (262 g)" },
      { productName: "McVitie's Rich Tea Biscuits (300 g)" },
    ]);
    assert.ok(hint);
    assert.match(hint ?? "", /clarifying question/i);
  });
});
