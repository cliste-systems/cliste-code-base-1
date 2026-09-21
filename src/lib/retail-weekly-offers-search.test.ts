import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRetailWeeklyOffersPromptSection,
  assessSyncedOffersFreshness,
  formatWeeklyOfferQuote,
  inferWeeklyOfferChannelFromQuery,
  inferWeeklyOfferFulfilmentFromQuery,
  inferWeeklyOfferServiceAreaFromQuery,
  inferWeeklyOffersListIntent,
  isRetailOfferWeekActive,
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
  const activeWeek = currentSupervaluOfferWeek();
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
    offer_week_start: activeWeek.start,
    offer_week_end: activeWeek.end,
    source_url: null,
    synced_at: "2026-09-10T06:00:00.000Z",
    ...partial,
  };
}

function mockSupabaseRows(rows: RetailWeeklyOfferRow[]) {
  const chain = {
    order: () => chain,
    limit: async () => ({ data: rows, error: null }),
    range: async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }),
    eq: () => chain,
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

  it("infers service area from query when no explicit filter is set", () => {
    assert.equal(
      resolveWeeklyOfferSearchFilters("deli offers", { serviceArea: "deli", fulfilment: "counter" })
        .serviceArea,
      "deli",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("butcher counter", {}).serviceArea,
      "butcher",
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("what alcohol is on offer", {}).serviceArea,
      "off_licence",
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
    assert.match(quote, /seventeen percent off/i);
    assert.match(quote, /Now twenty four euro ninety nine per kilo/i);
    assert.match(quote, /Usually twenty nine euro ninety nine per kilo/i);
  });

  it("leads with percent off and uses Usually for was price", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Pork Loin Chops",
      serviceArea: "butcher",
      fulfilment: "counter",
      currentPriceEur: 6.75,
      wasPriceEur: 13.49,
      priceUnitType: "kilogram",
      sellBy: "Unit",
    });
    assert.match(quote, /fifty percent off/i);
    assert.match(quote, /Now six euro seventy five per kilo/i);
    assert.match(quote, /Usually thirteen euro forty nine per kilo/i);
    const percentIndex = quote.indexOf("percent off");
    const nowIndex = quote.indexOf("Now six");
    assert.ok(percentIndex >= 0 && nowIndex > percentIndex);
  });

  it("formats pre-pack offers in short clear sentences", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "SuperValu Signature Tastes Thick Cut Chops with Pepper Sauce (600 g)",
      serviceArea: "butcher",
      fulfilment: "prepack",
      currentPriceEur: 6,
      wasPriceEur: 7.69,
    });
    assert.match(quote, /pre-pack meat aisle/i);
    assert.doesNotMatch(quote, /\(600 g\)/);
    assert.match(quote, /Now six euro\./i);
    assert.match(quote, /Usually seven euro sixty nine\./i);
  });

  it("computes Thursday-start offer weeks in Dublin time", () => {
    const week = currentSupervaluOfferWeek(new Date("2026-09-10T12:00:00Z"));
    assert.equal(week.start, "2026-09-10");
    assert.equal(week.end, "2026-09-16");
  });

  it("drops expired offer weeks from active filter", () => {
    const row = mockOfferRow({
      id: "expired",
      product_name: "Irish Striploin Steak",
      search_text: "striploin",
      offer_week_start: "2026-09-10",
      offer_week_end: "2026-09-16",
    });
    assert.equal(
      isRetailOfferWeekActive(row, new Date("2026-09-20T12:00:00Z")),
      false,
    );
    assert.equal(
      isRetailOfferWeekActive(row, new Date("2026-09-16T12:00:00Z")),
      true,
    );
  });

  it("flags stale synced offers when week ended", () => {
    const freshness = assessSyncedOffersFreshness({
      syncedAt: "2026-09-13T13:01:42.811Z",
      offerWeekEnd: "2026-09-16",
      reference: new Date("2026-09-20T12:00:00Z"),
    });
    assert.equal(freshness.stale, true);
    assert.match(freshness.message ?? "", /out of date/i);
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
    assert.match(quote, /twenty four percent off/i);
    assert.match(quote, /Now twelve euro ninety nine per kilo/i);
    assert.match(quote, /Usually sixteen euro ninety nine per kilo/i);
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

  it("lists butcher counter offers when caller chose counter after clarifying", async () => {
    const butcherRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "prepack-1",
        product_name: "Denny Luncheon Roll (90 g)",
        department: "Beef & Luncheon Meats",
        fulfilment: "prepack",
        offer_channel: "prepack",
        current_price_eur: 1,
        search_text: "denny luncheon roll prepack",
      }),
      mockOfferRow({
        id: "counter-1",
        product_name: "SuperValu Fresh Irish Pork Steak (1 kg)",
        department: "Pork",
        fulfilment: "counter",
        offer_channel: "butcher_counter",
        current_price_eur: 6.69,
        search_text: "supervalu fresh irish pork steak butcher counter",
      }),
      mockOfferRow({
        id: "counter-2",
        product_name: "SuperValu Fresh Irish Carvery Lamb Shoulder (1 kg)",
        department: "Lamb",
        fulfilment: "counter",
        offer_channel: "butcher_counter",
        current_price_eur: 9,
        search_text: "supervalu fresh irish carvery lamb shoulder butcher counter",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(butcherRows) as never,
      "supervalu",
      "what's on offer in the meat counter this week",
      { fulfilment: "counter" },
    );
    assert.equal(matches.length, 2);
    assert.ok(matches.every((match) => match.fulfilment === "counter"));
    assert.ok(
      matches.some((match) => /Pork Steak/i.test(match.productName)),
    );
    assert.ok(
      matches.every((match) => !/Denny Luncheon/i.test(match.productName)),
    );
  });

  it("does not infer fulfilment from caller phrasing alone", () => {
    assert.equal(
      resolveWeeklyOfferSearchFilters("what's on offer in the meat counter this week")
        .fulfilment,
      null,
    );
    assert.equal(
      resolveWeeklyOfferSearchFilters("meat counter steaks", { fulfilment: "counter" })
        .fulfilment,
      "counter",
    );
  });

  it("infers browse/list intent for general offer questions", () => {
    assert.equal(inferWeeklyOffersListIntent("best offers"), true);
    assert.equal(inferWeeklyOffersListIntent("what offers do you have apart from meat"), true);
    assert.equal(inferWeeklyOffersListIntent("milk bread crisps chocolate fruit"), true);
    assert.equal(inferWeeklyOffersListIntent("surprise me with your best one"), true);
    assert.equal(inferWeeklyOffersListIntent("deli offers"), true);
    assert.equal(inferWeeklyOffersListIntent("what alcohol is on offer"), true);
    assert.equal(inferWeeklyOffersListIntent("alcohol on offer"), true);
    assert.equal(inferWeeklyOffersListIntent("dairy on offer"), true);
    assert.equal(inferWeeklyOffersListIntent("ham"), false);
    assert.equal(inferWeeklyOffersListIntent("rashers"), false);
    assert.equal(
      inferWeeklyOffersListIntent("what offers in the meat counter this week"),
      true,
    );
    assert.equal(
      inferWeeklyOffersListIntent("what's on offer at the butcher counter"),
      true,
    );
    assert.equal(inferWeeklyOffersListIntent("what offers in the fruit and veg"), true);
    assert.equal(inferWeeklyOffersListIntent("any offers on the dairy wall"), true);
    assert.equal(inferWeeklyOffersListIntent("offers in the back store"), true);
    assert.equal(inferWeeklyOffersListIntent("fish offers this week"), true);
  });

  it("infers store section service areas from varied caller phrasing", () => {
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("dairy wall offers"), "grocery");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("back store specials"), "grocery");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("provisions on offer"), "grocery");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("fruit and veg offers"), "produce");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("off licence wine"), "off_licence");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("seafood counter salmon"), "fish");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("deli department ham"), "deli");
    assert.equal(inferWeeklyOfferServiceAreaFromQuery("meat department steaks"), "butcher");
  });

  it("only narrows fulfilment when the caller explicitly chose counter or pre-pack", () => {
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("deli offers"), null);
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("butcher offers"), null);
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("meat counter steaks"), "counter");
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("pre-pack ham"), "prepack");
    assert.equal(inferWeeklyOfferFulfilmentFromQuery("fish aisle salmon"), "prepack");
  });

  it("samples off-licence offers for alcohol category questions", async () => {
    const alcoholRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "a1",
        product_name: "Corona Extra Lager Bottle (620 ml)",
        department: "Beer",
        service_area: "off_licence",
        fulfilment: "prepack",
        current_price_eur: 3.5,
        is_alcohol: true,
        search_text: "corona extra lager beer off licence",
      }),
      mockOfferRow({
        id: "a2",
        product_name: "Brancott Estate Marlborough Sauvignon Blanc (75 cl)",
        department: "Wine",
        service_area: "off_licence",
        fulfilment: "prepack",
        current_price_eur: 12,
        is_alcohol: true,
        search_text: "brancott estate marlborough sauvignon blanc wine",
      }),
      mockOfferRow({
        id: "a3",
        product_name: "Brew Dog Punk Alcohol Free IPA Cans 4 Pack (330 ml)",
        department: "Beer",
        service_area: "grocery",
        fulfilment: "prepack",
        current_price_eur: 8,
        is_alcohol: false,
        search_text: "brew dog punk alcohol free ipa beer",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(alcoholRows) as never,
      "supervalu",
      "what alcohol is on offer",
    );
    assert.ok(matches.length >= 2);
    assert.ok(matches.every((match) => match.serviceArea === "off_licence"));
    assert.ok(matches.every((match) => match.isAlcohol === true));
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

  it("does not treat specific product offer questions as list intent", () => {
    assert.equal(inferWeeklyOffersListIntent("is striploin steak on offer"), false);
    assert.equal(inferWeeklyOffersListIntent("what offers in the meat counter this week"), true);
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

  it("finds corned beef without pulling unrelated beef offers", async () => {
    const cornedRows: RetailWeeklyOfferRow[] = [
      mockOfferRow({
        id: "c1",
        product_name: "Horgans Sliced Corned Beef (120 g)",
        department: "Beef & Lucheon Meats",
        service_area: "deli",
        fulfilment: "prepack",
        current_price_eur: 3,
        search_text: "horgans sliced corned beef deli",
      }),
      mockOfferRow({
        id: "c2",
        product_name: "SuperValu Beef Meatballs Promo (770 g)",
        department: "Beef",
        service_area: "butcher",
        fulfilment: "prepack",
        current_price_eur: 4,
        search_text: "supervalu beef meatballs promo",
      }),
      mockOfferRow({
        id: "c3",
        product_name: "SuperValu Fresh Irish Beef Sirloin Steak (1 kg)",
        department: "Beef Steaks",
        service_area: "butcher",
        fulfilment: "counter",
        current_price_eur: 16.74,
        search_text: "supervalu fresh irish beef sirloin steak",
      }),
    ];

    const matches = await searchRetailWeeklyOffers(
      mockSupabaseRows(cornedRows) as never,
      "supervalu",
      "corned beef",
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.productName ?? "", /Horgans Sliced Corned Beef/i);
    assert.match(matches[0]?.quoteText ?? "", /deli counter/i);
  });
});
