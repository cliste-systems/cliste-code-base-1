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

  it("formats a professional stock quote with callback offer", () => {
    const quote = formatCatalogStockQuote({
      productName: "Heinz Tomato Ketchup 570g",
      department: "Grocery",
    });
    assert.match(quote, /as far as I'm aware/i);
    assert.match(quote, /SuperValu range/i);
    assert.match(quote, /can't confirm it's on the shelf/i);
    assert.match(quote, /call you back/i);
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
