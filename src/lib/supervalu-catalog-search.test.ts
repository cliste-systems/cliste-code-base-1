import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expandSupervaluCatalogSearchQueries,
  formatCatalogStockNoMatchQuote,
  formatCatalogStockQuote,
  inferCatalogSearchIntent,
  normalizeSupervaluCatalogProduct,
  stripCatalogSearchBoilerplate,
} from "./supervalu-catalog-search";

describe("supervalu catalog search", () => {
  it("normalizes any gateway product with a name", () => {
    const product = normalizeSupervaluCatalogProduct({
      sku: "999",
      name: "Heinz Tomato Ketchup 570g",
      priceNumeric: 4.5,
      attributes: { altCategory: "Grocery" },
    });
    assert.ok(product);
    assert.match(product?.searchText ?? "", /heinz/);
    assert.match(product?.searchText ?? "", /ketchup/);
  });

  it("formats a professional stock quote with spoken national range price", () => {
    const quote = formatCatalogStockQuote({
      productName: "Weetabix 24 Pack (430 g)",
      department: "Cereals",
      currentPriceEur: 4.79,
      pricePerUnit: "€11.14/kg",
      isOnOffer: false,
      intent: "price",
    });
    assert.match(quote, /four euro seventy nine/i);
    assert.match(quote, /regular price/i);
    assert.match(quote, /not on offer this week/i);
  });

  it("formats promotional catalog prices with spoken was price", () => {
    const quote = formatCatalogStockQuote({
      productName: "Heinz Tomato Ketchup 570g",
      department: "Grocery",
      currentPriceEur: 3.5,
      wasPriceEur: 4.5,
      discountLabel: "Only €3.50",
      isOnOffer: true,
      intent: "price",
    });
    assert.match(quote, /on offer at three euro fifty/i);
    assert.match(quote, /was four euro fifty/i);
  });

  it("says not on offer when caller asks about offers", () => {
    const quote = formatCatalogStockQuote({
      productName: "Weetabix 24 Pack (430 g)",
      department: "Cereals",
      currentPriceEur: 4.79,
      isOnOffer: false,
      intent: "offer",
    });
    assert.match(quote, /not showing as on offer this week/i);
    assert.doesNotMatch(quote, /listed at four euro/i);
  });

  it("quotes offer price when caller asks about offers and product is promotional", () => {
    const quote = formatCatalogStockQuote({
      productName: "McVitie's Hobnobs Milk Chocolate Biscuits (262 g)",
      currentPriceEur: 2.5,
      wasPriceEur: 3.19,
      discountLabel: "Only €2.50",
      isOnOffer: true,
      intent: "offer",
    });
    assert.match(quote, /on offer this week at two euro fifty/i);
    assert.match(quote, /was three euro nineteen/i);
  });

  it("strips offer phrasing before product search", () => {
    assert.equal(
      stripCatalogSearchBoilerplate("is Weetabix on offer this week"),
      "Weetabix",
    );
    assert.equal(
      stripCatalogSearchBoilerplate("how much is Cadbury Snack Shortcake 5-pack"),
      "Cadbury Snack Shortcake 5-pack",
    );
  });

  it("infers offer intent from caller phrasing", () => {
    assert.equal(inferCatalogSearchIntent("is Weetabix on offer this week"), "offer");
    assert.equal(inferCatalogSearchIntent("how much is Weetabix"), "price");
    assert.equal(inferCatalogSearchIntent("do you stock Weetabix"), "stock");
  });

  it("expands sriracha queries to gateway-friendly chilli search", () => {
    const queries = expandSupervaluCatalogSearchQueries("Hellmann's Sriracha");
    assert.ok(queries.includes("Hellmann's chilli"));
    assert.ok(queries.some((q) => /chilli/i.test(q)));
  });

  it("does not claim stock on no match", () => {
    const quote = formatCatalogStockNoMatchQuote("unicorn meat");
    assert.match(quote, /couldn't find/i);
    assert.match(quote, /don't want to guess/i);
  });
});
