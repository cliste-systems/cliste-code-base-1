import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { fetchSupervaluMeatPilotOffers } from "@/lib/supervalu-offers-fetch";
import {
  persistSupervaluNationalOffers,
  toSupervaluOffersSyncResult,
} from "@/lib/supervalu-offers-persist";
import type { SupervaluOffersSyncResult } from "@/lib/supervalu-offers-types";

export {
  currentSupervaluOfferWeek,
  isPromotionalSupervaluProduct,
  normalizeSupervaluGatewayProduct,
} from "@/lib/supervalu-offers-normalize";

export async function syncSupervaluNationalOffers(
  supabase: SupabaseClient,
  options?: { storeId?: string },
): Promise<SupervaluOffersSyncResult> {
  const offers = await fetchSupervaluMeatPilotOffers(options?.storeId);
  const persisted = await persistSupervaluNationalOffers(supabase, offers);
  if (!persisted.ok) return persisted;

  for (const orgId of persisted.organizationIds) {
    await regenerateCaraCustomPrompt(supabase, orgId);
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
