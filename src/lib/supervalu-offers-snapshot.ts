import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatWeeklyOfferQuote,
  type WeeklyOfferMatch,
} from "@/lib/retail-weekly-offers-search";
import type { NormalizedWeeklyOffer } from "@/lib/supervalu-offers-normalize";
import type { RetailWeeklyOfferRow } from "@/lib/supervalu-offers-types";

export const RETAIL_OFFERS_BUCKET = "retail-offers";

export type SupervaluOffersSnapshot = {
  retailBanner: "supervalu";
  syncBatchId: string;
  syncedAt: string;
  offerWeekStart: string;
  offerWeekEnd: string;
  offerCount: number;
  serviceAreaCounts: Record<string, number>;
  offers: Array<{
    productName: string;
    department: string;
    offerChannel: string;
    serviceArea: string;
    fulfilment: string;
    currentPriceEur: number;
    wasPriceEur: number | null;
    discountLabel: string | null;
    pricePerUnit: string | null;
    categoryBreadcrumb: string | null;
    isAlcohol: boolean;
    brand: string | null;
    sku: string | null;
    quoteText: string;
  }>;
};

function countServiceAreas(offers: NormalizedWeeklyOffer[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const offer of offers) {
    counts[offer.serviceArea] = (counts[offer.serviceArea] ?? 0) + 1;
  }
  return counts;
}

export function buildSupervaluOffersSnapshot(input: {
  syncBatchId: string;
  syncedAt: string;
  offerWeekStart: string;
  offerWeekEnd: string;
  offers: NormalizedWeeklyOffer[];
}): SupervaluOffersSnapshot {
  return {
    retailBanner: "supervalu",
    syncBatchId: input.syncBatchId,
    syncedAt: input.syncedAt,
    offerWeekStart: input.offerWeekStart,
    offerWeekEnd: input.offerWeekEnd,
    offerCount: input.offers.length,
    serviceAreaCounts: countServiceAreas(input.offers),
    offers: input.offers.map((offer) => ({
      productName: offer.productName,
      department: offer.department,
      offerChannel: offer.offerChannel,
      serviceArea: offer.serviceArea,
      fulfilment: offer.fulfilment,
      currentPriceEur: offer.currentPriceEur,
      wasPriceEur: offer.wasPriceEur,
      discountLabel: offer.discountLabel,
      pricePerUnit: offer.pricePerUnit,
      categoryBreadcrumb: offer.categoryBreadcrumb,
      isAlcohol: offer.isAlcohol,
      brand: offer.brand,
      sku: offer.sku,
      quoteText: formatWeeklyOfferQuote({
        productName: offer.productName,
        offerChannel: offer.offerChannel,
        serviceArea: offer.serviceArea,
        fulfilment: offer.fulfilment,
        currentPriceEur: offer.currentPriceEur,
        wasPriceEur: offer.wasPriceEur,
        discountLabel: offer.discountLabel,
        pricePerUnit: offer.pricePerUnit,
        priceUnitType: offer.priceUnitType,
        sellBy: offer.sellBy,
        isAlcohol: offer.isAlcohol,
      }),
    })),
  };
}

export function buildSupervaluOffersSnapshotFromRows(input: {
  syncBatchId: string;
  syncedAt: string;
  offerWeekStart: string;
  offerWeekEnd: string;
  rows: RetailWeeklyOfferRow[];
}): SupervaluOffersSnapshot {
  const offers: NormalizedWeeklyOffer[] = input.rows.map((row) => ({
    productName: row.product_name,
    department: row.department,
    offerChannel: row.offer_channel,
    serviceArea: row.service_area,
    fulfilment: row.fulfilment,
    currentPriceEur: Number(row.current_price_eur),
    wasPriceEur: row.was_price_eur == null ? null : Number(row.was_price_eur),
    discountLabel: row.discount_label,
    pricePerUnit: row.price_per_unit,
    categoryBreadcrumb: row.category_breadcrumb,
    sellBy: row.sell_by,
    priceUnitType: row.price_unit_type,
    isAlcohol: row.is_alcohol,
    brand: row.brand,
    sku: row.sku,
    sourceUrl: row.source_url,
    searchText: row.search_text,
  }));
  return buildSupervaluOffersSnapshot({
    syncBatchId: input.syncBatchId,
    syncedAt: input.syncedAt,
    offerWeekStart: input.offerWeekStart,
    offerWeekEnd: input.offerWeekEnd,
    offers,
  });
}

export async function persistSupervaluOffersSnapshot(
  supabase: SupabaseClient,
  snapshot: SupervaluOffersSnapshot,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = JSON.stringify(snapshot, null, 2);
  const weekPath = `supervalu/${snapshot.offerWeekStart}.json`;
  const latestPath = "supervalu/latest.json";

  for (const path of [weekPath, latestPath]) {
    const { error } = await supabase.storage
      .from(RETAIL_OFFERS_BUCKET)
      .upload(path, body, {
        contentType: "application/json",
        upsert: true,
      });
    if (error) {
      return { ok: false, message: `Snapshot upload failed (${path}): ${error.message}` };
    }
  }

  return { ok: true };
}

export async function loadSupervaluOffersSnapshot(
  supabase: SupabaseClient,
  path = "supervalu/latest.json",
): Promise<SupervaluOffersSnapshot | null> {
  const { data, error } = await supabase.storage
    .from(RETAIL_OFFERS_BUCKET)
    .download(path);
  if (error || !data) return null;
  const text = await data.text();
  return JSON.parse(text) as SupervaluOffersSnapshot;
}

export type { WeeklyOfferMatch };
