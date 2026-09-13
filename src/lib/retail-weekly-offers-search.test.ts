import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRetailWeeklyOffersPromptSection,
  formatWeeklyOfferQuote,
  inferWeeklyOfferChannelFromQuery,
  inferWeeklyOfferFulfilmentFromQuery,
  inferWeeklyOfferServiceAreaFromQuery,
  inferWeeklyOffersListIntent,
  resolveWeeklyOfferSearchFilters,
  searchRetailWeeklyOffers,
} from "./retail-weekly-offers-search";
import type { RetailWeeklyOfferRow } from "./supervalu-offers-types";
import {
  classifySupervaluOfferChannel,
  classifySupervaluOfferServiceArea,
  currentSupervaluOfferWeek,
  isPromotionalSupervaluProduct,
  normalizeSupervaluGatewayProduct,
} from "./supervalu-offers-normalize";

function mockOfferRow(
  partial: Partial<RetailWeeklyOfferRow> & Pick<RetailWeeklyOfferRow, "id" | "product_name" | "search_text">,
): RetailWeeklyOfferRow {
  return {
    organization_id: null,
    retail_banner: "supervalu",
    sync_batch_id: "batch",
    department: "Butcher",
    offer_channel: "butcher_counter",
    service_area: "butcher",
    fulfilment: "counter",
    current_price_eur: 0,
    was_price_eur: null,
    discount_label: null,
    price_per_unit: null,
    category_breadcrumb: null,
    sell_by: null,
    price_unit_type: null,
    is_alcohol: false,
    brand: null,
    sku: null,
    offer_week_start: "2026-09-04",
    offer_week_end: "2026-09-10",
    source_url: null,
    synced_at: "2026-09-10T06:00:00.000Z",
    ...partial,
  };
}

function mockSupabaseRows(rows: RetailWeeklyOfferRow[]) {
  const chain = {
    order: () => chain,
    limit: async () => ({ data: rows, error: null }),
  };
  return {
    from: () => ({
      select: () => ({
        eq: () => chain,
      }),
    }),
  };
}

describe("supervalu offers sync helpers", () => {
  it("detects promotional gateway products", () => {
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 5,
        wasPriceNumeric: 8,
        priceSource: "regular",
      }),
      true,
    );
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 5,
        priceSource: "tpr",
      }),
      true,
    );
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 16.74,
        wasPriceNumeric: 24.99,
        priceSource: "promotion",
        promotions: [{ name: "Save 33%" }],
      }),
      true,
    );
    assert.equal(
      isPromotionalSupervaluProduct({
        priceNumeric: 5,
        priceSource: "regular",
      }),
      false,
    );
  });

  it("normalizes butcher counter sirloin percentage promotions", () => {
    const offer = normalizeSupervaluGatewayProduct(
      {
        sku: "1019164002",
        name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        priceNumeric: 16.7433,
        wasPriceNumeric: 24.99,
        priceSource: "promotion",
        pricePerUnit: "€16.74/kg",
        sellBy: "Unit",
        unitOfPrice: { type: "kilogram" },
        promotions: [{ name: "Save 33%", description: "Save 33%" }],
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Meat & Poultry/Beef/Butcher/Beef Steaks",
          },
        ],
        attributes: { altCategory: "Beef Steaks" },
      },
      "Butcher",
    );
    assert.ok(offer);
    assert.equal(offer?.serviceArea, "butcher");
    assert.equal(offer?.fulfilment, "counter");
    assert.equal(offer?.currentPriceEur, 16.7433);
    assert.equal(offer?.wasPriceEur, 24.99);
    assert.equal(offer?.discountLabel, "Save 33%");
  });

  it("classifies fish counter and pre-pack fish separately", () => {
    const counter = classifySupervaluOfferServiceArea({
      product: {
        name: "Loose Side of Salmon (700 g)",
        priceNumeric: 15.99,
        wasPriceNumeric: 18.49,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Fish & Seafood/Fish Counter",
          },
        ],
        attributes: { altCategory: "Fish Counter" },
      },
      productName: "Loose Side of Salmon (700 g)",
      department: "Fish Counter",
    });
    assert.equal(counter.serviceArea, "fish");
    assert.equal(counter.fulfilment, "counter");

    const prepack = classifySupervaluOfferServiceArea({
      product: {
        name: "Keohane's Salmon Fillets (480 g)",
        priceNumeric: 9,
        wasPriceNumeric: 10.99,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Fish & Seafood/Prepack Fresh Fish",
          },
        ],
        attributes: { altCategory: "Prepack Fresh Fish" },
      },
      productName: "Keohane's Salmon Fillets (480 g)",
      department: "Prepack Fresh Fish",
    });
    assert.equal(prepack.serviceArea, "fish");
    assert.equal(prepack.fulfilment, "prepack");

    const frozen = classifySupervaluOfferServiceArea({
      product: {
        name: "Birds Eye Battered 2 Fish Fillets (200 g)",
        priceNumeric: 2.5,
        wasPriceNumeric: 4.99,
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb:
              "Grocery/Frozen Foods/Frozen Fish & Seafood/Battered Fillets & Steaks",
          },
        ],
        attributes: { altCategory: "Battered Fillets & Steaks" },
      },
      productName: "Birds Eye Battered 2 Fish Fillets (200 g)",
      department: "Battered Fillets & Steaks",
    });
    assert.equal(frozen.serviceArea, "fish");
    assert.equal(frozen.fulfilment, "prepack");
  });

  it("classifies grocery promos separately from meat", () => {
    assert.equal(
      classifySupervaluOfferChannel({
        productName: "Cadbury Dairy Milk (110 g)",
        department: "Chocolate Bars",
        discountLabel: "Only €2",
      }),
      "grocery",
    );
  });

  it("classifies Carroll's deli counter ham separately from pre-pack chilled ham", () => {
    const counter = classifySupervaluOfferServiceArea({
      product: {
        name: "Carroll's of Tullamore Crumbed Ham (1 kg)",
        priceNumeric: 24.99,
        wasPriceNumeric: 29.99,
        priceLabel: "Only €24.99",
        pricePerUnit: "€24.99/kg",
        sellBy: "Unit",
        unitOfPrice: { type: "kilogram" },
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Deli Counter/Cooked Meats/Ham",
          },
        ],
        attributes: { altCategory: "Ham" },
      },
      productName: "Carroll's of Tullamore Crumbed Ham (1 kg)",
      department: "Ham",
      discountLabel: "Only €24.99",
    });
    assert.equal(counter.serviceArea, "deli");
    assert.equal(counter.fulfilment, "counter");

    const prepack = classifySupervaluOfferServiceArea({
      product: {
        name: "Carrolls of Tullamore Wafer Thin Traditional Ham (200 g)",
        priceNumeric: 3.5,
        pricePerUnit: "€17.50/kg",
        sellBy: "Each",
        defaultCategory: [
          {
            categoryBreadcrumb: "Grocery/Chilled Food/Sliced Cooked Meats/Ham",
          },
        ],
        attributes: { altCategory: "Ham" },
      },
      productName: "Carrolls of Tullamore Wafer Thin Traditional Ham (200 g)",
      department: "Ham",
    });
    assert.equal(prepack.serviceArea, "deli");
    assert.equal(prepack.fulfilment, "prepack");
  });

  it("classifies pre-pack quick fry separately from butcher counter", () => {
    assert.equal(
      classifySupervaluOfferChannel({
        productName: "SuperValu Salt & Chilli Beef Quick Fry Steak (280 g)",
        department: "Beef Steaks",
        discountLabel: "Only €4",
      }),
      "prepack",
    );
    assert.equal(
      classifySupervaluOfferChannel({
        productName: "Irish Striploin Steak",
        department: "Butcher",
        discountLabel: "3 for €10",
      }),
      "butcher_counter",
    );
  });

  it("does not infer service area from query text alone", () => {
    assert.equal(
      resolveWeeklyOfferSearchFilters("deli offers", { serviceArea: "deli", fulfilment: "counter" })
        .serviceArea,
      "deli",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("butcher counter", {}).serviceArea,
      null,
    );
  });

  it("normalizes gateway products into offer rows", () => {
    const offer = normalizeSupervaluGatewayProduct(
      {
        sku: "123",
        name: "Irish Striploin Steak",
        priceNumeric: 12.99,
        wasPriceNumeric: 16.99,
        priceLabel: "Only €12.99",
        pricePerUnit: "€12.99/kg",
        sellBy: "Unit",
        unitOfPrice: { type: "kilogram" },
        url: "https://shop.supervalu.ie/example",
        defaultCategory: [{ categoryBreadcrumb: "Grocery/Butcher/Beef Steaks" }],
        attributes: { altCategory: "Butcher" },
      },
      "Butcher",
    );
    assert.ok(offer);
    assert.equal(offer?.productName, "Irish Striploin Steak");
    assert.equal(offer?.serviceArea, "butcher");
    assert.equal(offer?.fulfilment, "counter");
    assert.equal(offer?.currentPriceEur, 12.99);
    assert.match(offer?.searchText ?? "", /striploin/);
  });

  it("formats deli counter ham quotes per kilo", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Carroll's Crumbed Ham",
      serviceArea: "deli",
      fulfilment: "counter",
      currentPriceEur: 24.99,
      wasPriceEur: 29.99,
      priceUnitType: "kilogram",
      sellBy: "Unit",
    });
    assert.match(quote, /deli counter/i);
    assert.match(quote, /per kilo/i);
    assert.match(quote, /twenty four euro ninety nine/i);
  });

  it("computes Thursday-start offer weeks in Dublin time", () => {
    const week = currentSupervaluOfferWeek(new Date("2026-09-10T12:00:00Z"));
    assert.equal(week.start, "2026-09-10");
    assert.equal(week.end, "2026-09-16");
  });
});

describe("retail weekly offers search", () => {
  const rows: RetailWeeklyOfferRow[] = [
    mockOfferRow({
      id: "1",
      product_name: "Irish Striploin Steak",
      department: "Butcher",
      offer_channel: "butcher_counter",
      service_area: "butcher",
      fulfilment: "counter",
      current_price_eur: 12.99,
      was_price_eur: 16.99,
      discount_label: "Only €12.99",
      price_per_unit: "€12.99/kg",
      sku: "123",
      search_text: "irish striploin steak butcher 123",
    }),
    mockOfferRow({
      id: "2",
      product_name: "Chicken Fillets",
      department: "Butcher",
      offer_channel: "butcher_counter",
      service_area: "butcher",
      fulfilment: "counter",
      current_price_eur: 5,
      sku: "456",
      search_text: "chicken fillets butcher 456",
    }),
  ];

  it("formats quote text without disclaimer", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Irish Striploin Steak",
      serviceArea: "butcher",
      fulfilment: "counter",
      currentPriceEur: 12.99,
      wasPriceEur: 16.99,
      discountLabel: "Only €12.99",
      priceUnitType: "kilogram",
    });
    assert.match(quote, /Irish Striploin Steak/);
    assert.match(quote, /twelve euro ninety nine/i);
    assert.match(quote, /was sixteen euro ninety nine/i);
    assert.doesNotMatch(quote, /local shop may vary/i);
  });

  it("builds a compact prompt section", () => {
    const section = buildRetailWeeklyOffersPromptSection({
      offers: rows,
      syncedAt: "2026-09-10T06:00:00.000Z",
    });
    assert.ok(section);
    assert.match(section ?? "", /searchSuperValuProducts/);
    assert.match(section ?? "", /Striploin/);
  });

  it("filters butcher counter queries away from pre-pack rows", async () => {
    const mixedRows: RetailWeeklyOfferRow[] = [
      ...rows,
      mockOfferRow({
        id: "3",
        product_name: "SuperValu Quick Fry Steak (280 g)",
        department: "Beef Steaks",
        offer_channel: "prepack",
        service_area: "butcher",
        fulfilment: "prepack",
        search_text: "supervalu quick fry steak beef steaks",
      }),
    ];

    const counterMatches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "steak",
      { serviceArea: "butcher", fulfilment: "counter" },
    );
    assert.equal(counterMatches.length, 1);
    assert.equal(counterMatches[0]?.fulfilment, "counter");
  });

  it("keeps deli counter ham out of butcher counter filters", async () => {
    const mixedRows: RetailWeeklyOfferRow[] = [
      ...rows,
      mockOfferRow({
        id: "4",
        product_name: "Carroll's of Tullamore Crumbed Ham (1 kg)",
        department: "Ham",
        offer_channel: "butcher_counter",
        service_area: "deli",
        fulfilment: "counter",
        current_price_eur: 24.99,
        search_text: "carrolls crumbed ham deli counter",
      }),
    ];

    const butcherMatches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "steak",
      { serviceArea: "butcher", fulfilment: "counter" },
    );
    assert.ok(butcherMatches.every((match) => match.serviceArea === "butcher"));

    const deliMatches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "ham",
      { serviceArea: "deli", fulfilment: "counter" },
    );
    assert.equal(deliMatches.length, 1);
    assert.match(deliMatches[0]?.productName ?? "", /Carroll/i);
  });

  it("lists deli counter offers without returning grocery when area is set", async () => {
    const mixedRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "5",
        product_name: "Activia Gut Health Cereals 4 Pack (115 g)",
        department: "Active Health",
        offer_channel: "prepack",
        service_area: "grocery",
        fulfilment: "prepack",
        current_price_eur: 2.99,
        search_text: "activia gut health cereals",
      }),
      mockOfferRow({
        id: "6",
        product_name: "SuperValu Traditional Cooked Ham (1 kg)",
        department: "Ham",
        offer_channel: "butcher_counter",
        service_area: "deli",
        fulfilment: "counter",
        current_price_eur: 22,
        search_text: "traditional cooked ham deli counter",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(mixedRows) as never,
      "supervalu",
      "ham",
      { serviceArea: "deli", fulfilment: "counter" },
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.productName ?? "", /Ham/i);
  });

  it("infers browse/list intent for general offer questions", () => {
    assert.equal(inferWeeklyOffersListIntent("best offers"), true);
    assert.equal(inferWeeklyOffersListIntent("what offers do you have apart from meat"), true);
    assert.equal(inferWeeklyOffersListIntent("milk bread crisps chocolate fruit"), true);
    assert.equal(inferWeeklyOffersListIntent("surprise me with your best one"), true);
    assert.equal(inferWeeklyOffersListIntent("deli offers"), true);
    assert.equal(inferWeeklyOffersListIntent("ham"), false);
    assert.equal(inferWeeklyOffersListIntent("rashers"), false);
  });

  it("finds meat offers by product tokens", async () => {
    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(rows) as never,
      "supervalu",
      "steak",
    );
    assert.ok(matches.length >= 1);
    assert.match(matches[0]?.productName ?? "", /Striploin/i);
  });

  it("scores striploin queries highest", async () => {
    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(rows) as never,
      "supervalu",
      "is striploin steak on offer",
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.productName, "Irish Striploin Steak");
  });

  it("finds pre-pack steak offers and drops breadcrumb-only steak matches", async () => {
    const steakRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "10",
        product_name: "SuperValu Salt & Chilli Beef Quick Fry Steak (280 g)",
        department: "Beef Steaks",
        offer_channel: "prepack",
        service_area: "butcher",
        fulfilment: "prepack",
        current_price_eur: 4,
        search_text:
          "supervalu salt chilli beef quick fry steak 280 g beef steaks pre pack",
      }),
      mockOfferRow({
        id: "11",
        product_name: "Donegal Catch Chip Shop Battered Fish Goujons (400 g)",
        department: "Breaded Fillets & Steaks",
        offer_channel: "prepack",
        service_area: "butcher",
        fulfilment: "prepack",
        current_price_eur: 4.5,
        search_text:
          "donegal catch chip shop battered fish goujons breaded fillets steaks frozen fish",
      }),
    ];

    const counterOnly = await searchRetailWeeklyOffers(
      mockSupabaseRows(steakRows) as never,
      "supervalu",
      "steaks",
      { serviceArea: "butcher", fulfilment: "counter" },
    );
    assert.equal(counterOnly.length, 0);

    const butcherSteaks = await searchRetailWeeklyOffers(
      mockSupabaseRows(steakRows) as never,
      "supervalu",
      "steaks",
      { serviceArea: "butcher" },
    );
    assert.equal(butcherSteaks.length, 1);
    assert.match(butcherSteaks[0]?.productName ?? "", /Quick Fry Steak/i);
  });
});
