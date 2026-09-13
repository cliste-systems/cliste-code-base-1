import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchSupervaluFullStoreOffers,
  fetchSupervaluMeatPilotOffers,
} from "@/lib/supervalu-offers-fetch";
import {
  persistSupervaluNationalOffers,
  toSupervaluOffersSyncResult,
} from "@/lib/supervalu-offers-persist";
import {
  buildSupervaluOffersSnapshot,
  persistSupervaluOffersSnapshot,
} from "@/lib/supervalu-offers-snapshot";
import {
  SUPERVALU_MIN_FULL_STORE_OFFER_COUNT,
  type SupervaluOffersSyncResult,
} from "@/lib/supervalu-offers-types";

export {
  currentSupervaluOfferWeek,
  isPromotionalSupervaluProduct,
  normalizeSupervaluGatewayProduct,
} from "@/lib/supervalu-offers-normalize";

export type SyncSupervaluNationalOffersOptions = {
  storeId?: string;
  /** When true, skip sync if latest batch already meets the minimum count. */
  retryOnlyIfLowCount?: boolean;
  /** Use legacy meat-only fetch instead of full-store snapshot. */
  meatPilotOnly?: boolean;
  /** Skip Cara prompt recompile (CLI scripts). */
  skipPromptRecompile?: boolean;
};

export async function syncSupervaluNationalOffers(
  supabase: SupabaseClient,
  options?: SyncSupervaluNationalOffersOptions,
): Promise<SupervaluOffersSyncResult> {
  if (options?.retryOnlyIfLowCount) {
    const meta = await loadLatestSupervaluOfferSyncMeta(supabase);
    if (
      meta.syncedAt &&
      meta.offerCount >= SUPERVALU_MIN_FULL_STORE_OFFER_COUNT
    ) {
      return {
        ok: true,
        syncBatchId: "skipped-retry",
        offerCount: meta.offerCount,
        organizationsUpdated: 0,
        offerWeekStart: meta.offerWeekStart ?? "",
        offerWeekEnd: meta.offerWeekEnd ?? "",
        syncedAt: meta.syncedAt,
      };
    }
  }

  const offers = options?.meatPilotOnly
    ? await fetchSupervaluMeatPilotOffers(options?.storeId)
    : await fetchSupervaluFullStoreOffers(options?.storeId);

  if (
    offers.length > 0 &&
    offers.length < SUPERVALU_MIN_FULL_STORE_OFFER_COUNT &&
    !options?.meatPilotOnly
  ) {
    console.warn(
      "[supervalu-offers-sync] low offer count",
      offers.length,
      "expected at least",
      SUPERVALU_MIN_FULL_STORE_OFFER_COUNT,
    );
  }

  const persisted = await persistSupervaluNationalOffers(supabase, offers);
  if (!persisted.ok) return persisted;

  const snapshot = buildSupervaluOffersSnapshot({
    syncBatchId: persisted.syncBatchId,
    syncedAt: persisted.syncedAt,
    offerWeekStart: persisted.offerWeekStart,
    offerWeekEnd: persisted.offerWeekEnd,
    offers,
  });
  const snapshotResult = await persistSupervaluOffersSnapshot(supabase, snapshot);
  if (!snapshotResult.ok) {
    console.error("[supervalu-offers-sync]", snapshotResult.message);
  }

  if (!options?.skipPromptRecompile) {
    const { regenerateCaraCustomPrompt } = await import("@/lib/cara-prompt-from-org");
    for (const orgId of persisted.organizationIds) {
      await regenerateCaraCustomPrompt(supabase, orgId);
    }
  }

  return toSupervaluOffersSyncResult(persisted);
}

export async function loadLatestSupervaluOfferSyncMeta(
  supabase: SupabaseClient,
): Promise<{
  syncedAt: string | null;
  offerCount: number;
  offerWeekStart: string | null;
  offerWeekEnd: string | null;
}> {
  const { data, error } = await supabase
    .from("retail_weekly_offers")
    .select("synced_at, offer_week_start, offer_week_end")
    .eq("retail_banner", "supervalu")
    .order("synced_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    return {
      syncedAt: null,
      offerCount: 0,
      offerWeekStart: null,
      offerWeekEnd: null,
    };
  }

  const latest = data[0];
  const { count } = await supabase
    .from("retail_weekly_offers")
    .select("id", { count: "exact", head: true })
    .eq("retail_banner", "supervalu")
    .eq("synced_at", latest.synced_at);

  return {
    syncedAt: String(latest.synced_at ?? ""),
    offerCount: count ?? 0,
    offerWeekStart: String(latest.offer_week_start ?? ""),
    offerWeekEnd: String(latest.offer_week_end ?? ""),
  };
}
