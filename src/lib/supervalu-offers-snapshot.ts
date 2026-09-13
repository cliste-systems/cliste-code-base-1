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
  offers: Array<{
    productName: string;
    department: string;
    offerChannel: string;
    currentPriceEur: number;
    wasPriceEur: number | null;
    discountLabel: string | null;
    pricePerUnit: string | null;
    sku: string | null;
    quoteText: string;
  }>;
};

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
    offers: input.offers.map((offer) => ({
      productName: offer.productName,
      department: offer.department,
      offerChannel: offer.offerChannel,
      currentPriceEur: offer.currentPriceEur,
      wasPriceEur: offer.wasPriceEur,
      discountLabel: offer.discountLabel,
      pricePerUnit: offer.pricePerUnit,
      sku: offer.sku,
      quoteText: formatWeeklyOfferQuote({
        productName: offer.productName,
        offerChannel: offer.offerChannel,
        currentPriceEur: offer.currentPriceEur,
        wasPriceEur: offer.wasPriceEur,
        discountLabel: offer.discountLabel,
        pricePerUnit: offer.pricePerUnit,
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
  return buildSupervaluOffersSnapshot({
    syncBatchId: input.syncBatchId,
    syncedAt: input.syncedAt,
    offerWeekStart: input.offerWeekStart,
    offerWeekEnd: input.offerWeekEnd,
    offers: input.rows.map((row) => ({
      productName: row.product_name,
      department: row.department,
      offerChannel: row.offer_channel,
      currentPriceEur: Number(row.current_price_eur),
      wasPriceEur: row.was_price_eur == null ? null : Number(row.was_price_eur),
      discountLabel: row.discount_label,
      pricePerUnit: row.price_per_unit,
      sku: row.sku,
      sourceUrl: row.source_url,
      searchText: row.search_text,
    })),
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
