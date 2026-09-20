import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";

import {
  fetchSupervaluFullStoreOffers,
  fetchSupervaluMeatPilotOffers,
  countOffersByServiceArea,
} from "@/lib/supervalu-offers-fetch";
import {
  currentSupervaluOfferWeek,
} from "@/lib/supervalu-offers-normalize";
import {
  persistSupervaluNationalOffers,
  toSupervaluOffersSyncResult,
} from "@/lib/supervalu-offers-persist";
import {
  buildSupervaluOffersSnapshot,
  persistSupervaluOffersSnapshot,
} from "@/lib/supervalu-offers-snapshot";
import { SUPERVALU_SERVICE_AREA_MIN_COUNTS } from "@/lib/supervalu-promo-category-map";
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
  /** Cron: skip when today's sync already loaded the current offer week. */
  skipIfAlreadySyncedToday?: boolean;
  /** Cron safety net: only sync when the DB is still on a prior offer week. */
  retryOnlyIfStaleWeek?: boolean;
  /** @deprecated Use retryOnlyIfStaleWeek on the Friday safety-net cron. */
  retryOnlyIfLowCount?: boolean;
  /** Use legacy meat-only fetch instead of full-store snapshot. */
  meatPilotOnly?: boolean;
  /** Skip Cara prompt recompile (CLI scripts). */
  skipPromptRecompile?: boolean;
};

const DUBLIN = "Europe/Dublin";

export type SupervaluOfferSyncMeta = {
  syncedAt: string | null;
  offerCount: number;
  offerWeekStart: string | null;
  offerWeekEnd: string | null;
};

/** True when the stored batch is from a previous SuperValu offer week. */
export function isSupervaluOfferWeekStale(
  meta: Pick<SupervaluOfferSyncMeta, "offerWeekStart" | "offerWeekEnd">,
  reference = new Date(),
): boolean {
  const week = currentSupervaluOfferWeek(reference);
  const start = String(meta.offerWeekStart ?? "").trim();
  if (!start || start !== week.start) return true;
  const today = formatInTimeZone(reference, DUBLIN, "yyyy-MM-dd");
  const end = String(meta.offerWeekEnd ?? "").trim();
  return !end || end < today;
}

/** Thursday repeat crons: skip when we already synced the current week today. */
export function shouldSkipThursdayOffersSync(
  meta: SupervaluOfferSyncMeta,
  reference = new Date(),
): boolean {
  if (isSupervaluOfferWeekStale(meta, reference)) return false;
  if (meta.offerCount < SUPERVALU_MIN_FULL_STORE_OFFER_COUNT) return false;
  if (!meta.syncedAt) return false;
  const syncedDay = formatInTimeZone(new Date(meta.syncedAt), DUBLIN, "yyyy-MM-dd");
  const today = formatInTimeZone(reference, DUBLIN, "yyyy-MM-dd");
  return syncedDay === today;
}

function skippedSyncResult(
  reason: string,
  meta: SupervaluOfferSyncMeta,
): SupervaluOffersSyncResult {
  return {
    ok: true,
    syncBatchId: reason,
    offerCount: meta.offerCount,
    organizationsUpdated: 0,
    offerWeekStart: meta.offerWeekStart ?? "",
    offerWeekEnd: meta.offerWeekEnd ?? "",
    syncedAt: meta.syncedAt ?? new Date().toISOString(),
  };
}

export async function syncSupervaluNationalOffers(
  supabase: SupabaseClient,
  options?: SyncSupervaluNationalOffersOptions,
): Promise<SupervaluOffersSyncResult> {
  const meta = await loadLatestSupervaluOfferSyncMeta(supabase);

  if (options?.retryOnlyIfStaleWeek) {
    if (!isSupervaluOfferWeekStale(meta)) {
      return skippedSyncResult("skipped-current-week", meta);
    }
  } else if (options?.retryOnlyIfLowCount) {
    if (
      meta.syncedAt &&
      meta.offerCount >= SUPERVALU_MIN_FULL_STORE_OFFER_COUNT &&
      !isSupervaluOfferWeekStale(meta)
    ) {
      return skippedSyncResult("skipped-retry", meta);
    }
  }

  if (options?.skipIfAlreadySyncedToday && shouldSkipThursdayOffersSync(meta)) {
    return skippedSyncResult("skipped-already-synced-today", meta);
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

  const areaCounts = countOffersByServiceArea(offers);
  for (const [area, min] of Object.entries(SUPERVALU_SERVICE_AREA_MIN_COUNTS)) {
    const count = areaCounts[area] ?? 0;
    if (count < min && !options?.meatPilotOnly) {
      console.warn(
        "[supervalu-offers-sync] low service_area count",
        area,
        count,
        "expected at least",
        min,
      );
    }
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
): Promise<SupervaluOfferSyncMeta> {
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
