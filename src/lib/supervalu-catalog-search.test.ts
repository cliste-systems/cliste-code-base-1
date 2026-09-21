import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expandSupervaluCatalogSearchQueries,
  filterCatalogMatchesByQuery,
  formatCatalogStockNoMatchQuote,
  formatCatalogStockQuote,
  formatOfferFulfilmentMissQuote,
  formatOwnBrandFallbackQuote,
  inferCatalogOfferBrowseCategories,
  inferCatalogSearchIntent,
  normalizeCatalogBrandQuery,
  normalizeSupervaluCatalogProduct,
  stripCatalogPackagingNoise,
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

  it("returns no browse categories — product-token search only", () => {
    assert.deepEqual(inferCatalogOfferBrowseCategories("weekly offers"), []);
    assert.deepEqual(inferCatalogOfferBrowseCategories("milk bread crisps"), []);
  });

  it("expands sriracha queries to gateway-friendly chilli search", () => {
    const queries = expandSupervaluCatalogSearchQueries("Hellmann's Sriracha");
    assert.ok(queries.includes("Hellmann's chilli"));
    assert.ok(queries.some((q) => /chilli/i.test(q)));
  });

  it("strips packaging noise and searches core product term first", () => {
    assert.equal(stripCatalogPackagingNoise("turkey packets"), "turkey");
    assert.equal(stripCatalogPackagingNoise("pre-pack turkey"), "turkey");
    const queries = expandSupervaluCatalogSearchQueries("turkey packets");
    assert.equal(queries[0], "turkey");
    assert.ok(queries.includes("turkey packets"));
  });

  it("expands brand plus product queries without hardcoding brands", () => {
    const queries = expandSupervaluCatalogSearchQueries("greenfarm turkey");
    assert.ok(queries.includes("greenfarm turkey"));
    assert.ok(queries.includes("greenfarm"));
  });

  it("does not claim stock on no match", () => {
    const quote = formatCatalogStockNoMatchQuote("unicorn meat");
    assert.match(quote, /couldn't find/i);
    assert.match(quote, /don't want to guess/i);
  });

  it("normalizes own-brand phrasing for search", () => {
    assert.equal(
      normalizeCatalogBrandQuery("SuperValu own brand dried egg noodles"),
      "SuperValu dried egg noodles",
    );
    assert.ok(
      expandSupervaluCatalogSearchQueries("SuperValu own brand dried egg noodles").some(
        (q) => q.toLowerCase() === "supervalu egg noodles",
      ),
    );
  });

  it("fuzzy-filters a minor STT slip to fillet steak", () => {
    const matches = filterCatalogMatchesByQuery("filled steak", [
      {
        productName: "SuperValu Signature Tastes Hereford Irish Fillet Steak (370 g)",
        department: "Beef Steaks",
        sku: "1347278000",
        currentPriceEur: 15.99,
        wasPriceEur: 18.99,
        discountLabel: "Rewards Price Only €15.99",
        isOnOffer: true,
        score: 0.95,
        quoteText: "fillet",
      },
      {
        productName: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        department: "Butcher",
        sku: "1019164002",
        currentPriceEur: 16.74,
        wasPriceEur: 24.99,
        discountLabel: "Save 33%",
        isOnOffer: true,
        score: 0.55,
        quoteText: "sirloin",
      },
    ]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.productName ?? "", /Fillet Steak/i);
  });

  it("filters SuperValu fish queries to fish-finger products only", () => {
    const matches = filterCatalogMatchesByQuery("SuperValu fish fingers", [
      {
        productName: "SuperValu Atlantic Crab Meat (140 g)",
        department: "Fish",
        sku: null,
        currentPriceEur: 3,
        wasPriceEur: null,
        discountLabel: null,
        isOnOffer: false,
        score: 0.66,
        quoteText: "crab",
      },
      {
        productName: "Birds Eye Crispy Fish Fingers 8 Pack (224 g)",
        department: "Fish Fingers",
        sku: null,
        currentPriceEur: 2.5,
        wasPriceEur: null,
        discountLabel: null,
        isOnOffer: true,
        score: 1,
        quoteText: "fingers",
      },
    ]);
    assert.equal(matches.length, 0);
  });

  it("formats own-brand fallback without denying the product exists", () => {
    const quote = formatOwnBrandFallbackQuote("fish fingers", [
      {
        productName: "Birds Eye Crispy Fish Fingers 8 Pack (224 g)",
        department: "Fish Fingers",
        sku: null,
        currentPriceEur: 2.5,
        wasPriceEur: null,
        discountLabel: null,
        isOnOffer: true,
        score: 1,
        quoteText: "fingers",
      },
    ]);
    assert.match(quote, /don't see a SuperValu own-label match/i);
    assert.match(quote, /doesn't mean we never stock it/i);
    assert.match(quote, /Birds Eye/i);
  });

  const sirloinOffer = {
    productName: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
    department: "Butcher",
    sku: null,
    currentPriceEur: 16.74,
    wasPriceEur: null,
    discountLabel: "Only €16.74",
    isOnOffer: true,
    score: 1,
    quoteText: "At the butcher counter this week — sirloin steak",
  };

  it("keeps steak offers for natural caller phrasing", () => {
    for (const query of [
      "steaks",
      "steak",
      "steaks on offer this week",
      "is there any steaks on offer this week",
      "any steaks on offer",
      "meat counter steaks",
      "what offers in the meat counter this week",
      "hello just wondering any steaks on offer",
    ]) {
      const matches = filterCatalogMatchesByQuery(query, [sirloinOffer]);
      assert.equal(
        matches.length,
        1,
        `expected steak match for query: ${query}`,
      );
    }
  });

  const deliHamOffer = {
    productName: "SuperValu Traditional Cooked Ham (1 kg)",
    department: "Ham",
    sku: null,
    currentPriceEur: 22,
    wasPriceEur: null,
    discountLabel: null,
    isOnOffer: true,
    score: 1,
    quoteText: "deli ham",
  };

  const wineOffer = {
    productName: "Brancott Estate Marlborough Sauvignon Blanc (75 cl)",
    department: "Wine",
    sku: null,
    currentPriceEur: 12,
    wasPriceEur: null,
    discountLabel: null,
    isOnOffer: true,
    score: 1,
    quoteText: "wine",
  };

  it("keeps offers for natural phrasing across store sections", () => {
    assert.equal(
      filterCatalogMatchesByQuery("any wine on offer this week", [wineOffer]).length,
      1,
    );
    assert.equal(
      filterCatalogMatchesByQuery("what offers in the deli this week", [deliHamOffer]).length,
      1,
    );
    assert.equal(
      filterCatalogMatchesByQuery("off licence beer offers", [wineOffer]).length,
      1,
    );
    assert.equal(
      filterCatalogMatchesByQuery("dairy wall yogurt on offer", [
        {
          ...wineOffer,
          productName: "Activia Strawberry Yogurt 4 Pack (480 g)",
          quoteText: "yogurt",
        },
      ]).length,
      1,
    );
  });

  it("formats fulfilment miss quotes with alternate synced offers", () => {
    const quote = formatOfferFulfilmentMissQuote({
      query: "sirloin",
      requestedFulfilment: "counter",
      alternateMatches: [
        {
          quoteText:
            "In the pre-pack meat aisle this week. SuperValu Signature Tastes Wagyu Sirloin Steak. twenty percent off.",
        },
      ],
    });
    assert.match(quote, /No synced weekly offer for "sirloin" at the butcher counter/i);
    assert.match(quote, /pre-pack aisle/i);
    assert.match(quote, /Wagyu Sirloin/i);
    assert.doesNotMatch(quote, /never sell/i);
  });
});
