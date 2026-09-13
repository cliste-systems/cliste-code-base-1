import type { SupabaseClient } from "@supabase/supabase-js";

import {
  currentSupervaluOfferWeek,
  type NormalizedWeeklyOffer,
} from "@/lib/supervalu-offers-normalize";
import {
  SUPERVALU_OFFERS_SYNC_SOURCE,
  type SupervaluOffersSyncResult,
} from "@/lib/supervalu-offers-types";

export async function persistSupervaluNationalOffers(
  supabase: SupabaseClient,
  offers: NormalizedWeeklyOffer[],
): Promise<
  | {
      ok: true;
      syncBatchId: string;
      offerCount: number;
      organizationIds: string[];
      offerWeekStart: string;
      offerWeekEnd: string;
      syncedAt: string;
      serviceAreaCounts: Record<string, number>;
    }
  | { ok: false; message: string }
> {
  if (offers.length === 0) {
    return {
      ok: false,
      message:
        "SuperValu sync returned no promotional offers — the feed may have changed or not updated yet.",
    };
  }

  const syncedAt = new Date().toISOString();
  const syncBatchId = crypto.randomUUID();
  const week = currentSupervaluOfferWeek(new Date());
  const serviceAreaCounts: Record<string, number> = {};

  const rows = offers.map((offer) => {
    serviceAreaCounts[offer.serviceArea] =
      (serviceAreaCounts[offer.serviceArea] ?? 0) + 1;
    return {
      organization_id: null,
      retail_banner: "supervalu",
      sync_batch_id: syncBatchId,
      product_name: offer.productName,
      department: offer.department,
      offer_channel: offer.offerChannel,
      service_area: offer.serviceArea,
      fulfilment: offer.fulfilment,
      current_price_eur: offer.currentPriceEur,
      was_price_eur: offer.wasPriceEur,
      discount_label: offer.discountLabel,
      price_per_unit: offer.pricePerUnit,
      category_breadcrumb: offer.categoryBreadcrumb,
      sell_by: offer.sellBy,
      price_unit_type: offer.priceUnitType,
      is_alcohol: offer.isAlcohol,
      brand: offer.brand,
      sku: offer.sku,
      offer_week_start: week.start,
      offer_week_end: week.end,
      source_url: offer.sourceUrl,
      search_text: offer.searchText,
      synced_at: syncedAt,
    };
  });

  const { error: insertError } = await supabase
    .from("retail_weekly_offers")
    .insert(rows);
  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  const { data: retailOrgs, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("niche", "retail")
    .eq("retail_banner", "supervalu");
  if (orgError) {
    return { ok: false, message: orgError.message };
  }

  const orgIds = (retailOrgs ?? []).map((row) => String(row.id));
  if (orgIds.length > 0) {
    const { error: orgUpdateError } = await supabase
      .from("organizations")
      .update({
        offers_synced_at: syncedAt,
        offers_sync_source: SUPERVALU_OFFERS_SYNC_SOURCE,
        updated_at: syncedAt,
      })
      .in("id", orgIds);
    if (orgUpdateError) {
      return { ok: false, message: orgUpdateError.message };
    }
  }

  const { error: cleanupError } = await supabase
    .from("retail_weekly_offers")
    .delete()
    .eq("retail_banner", "supervalu")
    .neq("sync_batch_id", syncBatchId);
  if (cleanupError) {
    return { ok: false, message: cleanupError.message };
  }

  return {
    ok: true,
    syncBatchId,
    offerCount: offers.length,
    organizationIds: orgIds,
    offerWeekStart: week.start,
    offerWeekEnd: week.end,
    syncedAt,
    serviceAreaCounts,
  };
}

export function toSupervaluOffersSyncResult(
  persisted: Extract<
    Awaited<ReturnType<typeof persistSupervaluNationalOffers>>,
    { ok: true }
  >,
): Extract<SupervaluOffersSyncResult, { ok: true }> {
  return {
    ok: true,
    syncBatchId: persisted.syncBatchId,
    offerCount: persisted.offerCount,
    organizationsUpdated: persisted.organizationIds.length,
    offerWeekStart: persisted.offerWeekStart,
    offerWeekEnd: persisted.offerWeekEnd,
    syncedAt: persisted.syncedAt,
    serviceAreaCounts: persisted.serviceAreaCounts,
  };
}
