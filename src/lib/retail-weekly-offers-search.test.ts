import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRetailWeeklyOffersPromptSection,
  formatWeeklyOfferQuote,
  searchRetailWeeklyOffers,
} from "./retail-weekly-offers-search";
import type { RetailWeeklyOfferRow } from "./supervalu-offers-types";
import {
  currentSupervaluOfferWeek,
  isPromotionalSupervaluProduct,
  normalizeSupervaluGatewayProduct,
} from "./supervalu-offers-normalize";

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
        priceNumeric: 5,
        priceSource: "regular",
      }),
      false,
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
        url: "https://shop.supervalu.ie/example",
        attributes: { altCategory: "Butcher" },
      },
      "Butcher",
    );
    assert.ok(offer);
    assert.equal(offer?.productName, "Irish Striploin Steak");
    assert.equal(offer?.currentPriceEur, 12.99);
    assert.match(offer?.searchText ?? "", /striploin/);
  });

  it("computes Thursday-start offer weeks in Dublin time", () => {
    const week = currentSupervaluOfferWeek(new Date("2026-09-10T12:00:00Z"));
    assert.equal(week.start, "2026-09-10");
    assert.equal(week.end, "2026-09-16");
  });
});

describe("retail weekly offers search", () => {
  const rows: RetailWeeklyOfferRow[] = [
    {
      id: "1",
      organization_id: null,
      retail_banner: "supervalu",
      sync_batch_id: "batch",
      product_name: "Irish Striploin Steak",
      department: "Butcher",
      current_price_eur: 12.99,
      was_price_eur: 16.99,
      discount_label: "Only €12.99",
      price_per_unit: "€12.99/kg",
      sku: "123",
      offer_week_start: "2026-09-04",
      offer_week_end: "2026-09-10",
      source_url: null,
      search_text: "irish striploin steak butcher 123",
      synced_at: "2026-09-10T06:00:00.000Z",
    },
    {
      id: "2",
      organization_id: null,
      retail_banner: "supervalu",
      sync_batch_id: "batch",
      product_name: "Chicken Fillets",
      department: "Butcher",
      current_price_eur: 5,
      was_price_eur: null,
      discount_label: null,
      price_per_unit: null,
      sku: "456",
      offer_week_start: "2026-09-04",
      offer_week_end: "2026-09-10",
      source_url: null,
      search_text: "chicken fillets butcher 456",
      synced_at: "2026-09-10T06:00:00.000Z",
    },
  ];

  it("formats quote text without disclaimer", () => {
    const quote = formatWeeklyOfferQuote({
      productName: "Irish Striploin Steak",
      currentPriceEur: 12.99,
      wasPriceEur: 16.99,
      discountLabel: "Only €12.99",
    });
    assert.match(quote, /Irish Striploin Steak/);
    assert.match(quote, /€12\.99/);
    assert.doesNotMatch(quote, /local shop may vary/i);
  });

  it("builds a compact prompt section", () => {
    const section = buildRetailWeeklyOffersPromptSection({
      offers: rows,
      syncedAt: "2026-09-10T06:00:00.000Z",
    });
    assert.ok(section);
    assert.match(section ?? "", /search_weekly_offers/);
    assert.match(section ?? "", /Striploin/);
  });

  it("scores striploin queries highest", async () => {
    const supabase = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      order() {
                        return {
                          limit: async () => ({ data: rows, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const matches = await searchRetailWeeklyOffers(
      supabase as never,
      "supervalu",
      "is striploin steak on offer",
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.productName, "Irish Striploin Steak");
  });
});
