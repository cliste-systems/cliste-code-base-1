import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expandSupervaluCatalogSearchQueries,
  formatCatalogStockNoMatchQuote,
  formatCatalogStockQuote,
  normalizeSupervaluCatalogProduct,
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
    });
    assert.match(quote, /listed at four euro seventy nine/i);
    assert.match(quote, /eleven euro fourteen per kilo/i);
    assert.match(quote, /can't confirm today's shelf price/i);
  });

  it("formats promotional catalog prices with spoken was price", () => {
    const quote = formatCatalogStockQuote({
      productName: "Heinz Tomato Ketchup 570g",
      department: "Grocery",
      currentPriceEur: 3.5,
      wasPriceEur: 4.5,
      discountLabel: "Only €3.50",
    });
    assert.match(quote, /on offer at three euro fifty/i);
    assert.match(quote, /was four euro fifty/i);
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
