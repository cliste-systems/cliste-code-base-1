import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatStoreAssortmentQuote } from "@/lib/retail-store-assortment";

describe("store product assortment guardrails", () => {
  it("does not turn an unknown national catalogue match into store stock", () => {
    const quote = formatStoreAssortmentQuote({
      productName: "SuperValu Wagyu Sirloin Steak",
      status: "not_confirmed",
      intent: "stock",
      originalQuote: "As far as I'm aware, yes — we carry it.",
    });

    assert.match(quote, /has not confirmed whether it normally stocks it/i);
    assert.match(quote, /Do not say that this store carries it/i);
    assert.doesNotMatch(quote, /yes — we carry/i);
  });

  it("honours an explicit not-stocked decision", () => {
    const quote = formatStoreAssortmentQuote({
      productName: "SuperValu Wagyu Sirloin Steak",
      status: "not_stocked",
      intent: "offer",
      originalQuote: "It is on offer nationally.",
    });

    assert.match(quote, /does not normally stock it/i);
    assert.match(quote, /Do not tell the caller that this store carries it/i);
  });

  it("keeps normal assortment separate from live shelf inventory", () => {
    const quote = formatStoreAssortmentQuote({
      productName: "Heinz Tomato Ketchup",
      status: "stocked",
      intent: "stock",
      originalQuote: "Catalogue result.",
    });

    assert.match(quote, /normally stocks/i);
    assert.match(quote, /not live shelf inventory/i);
    assert.match(quote, /do not promise it is available right now/i);
  });
});
