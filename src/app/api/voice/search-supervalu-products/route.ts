import { NextResponse } from "next/server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import {
  assessSyncedOffersFreshness,
  inferWeeklyOfferFulfilmentFromQuery,
  loadLatestRetailOfferWeekEnd,
  offerSearchProductTokens,
} from "@/lib/retail-weekly-offers-search";
import type { SupervaluFulfilment } from "@/lib/supervalu-offers-types";
import { resolveProductSearchResponse } from "@/lib/retail-product-clarification";
import {
  formatCatalogStockNoMatchQuote,
  formatOfferFulfilmentMissQuote,
  inferCatalogSearchIntent,
  searchSupervaluCatalogLiveWithFallback,
  SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS,
  type CatalogQuoteIntent,
} from "@/lib/supervalu-catalog-search";
import {
  authorizeVoiceWebhook,
  voiceWebhookNoSecretResponse,
  voiceWebhookUnauthorizedResponse,
} from "@/lib/voice-webhook-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type SearchSupervaluProductsBody = {
  called_number?: string;
  query?: string;
  intent?: CatalogQuoteIntent;
  fulfilment?: "counter" | "prepack";
};

/**
 * Voice worker: SuperValu product lookup — stock, price, and synced weekly offers.
 */
export async function POST(request: Request) {
  const auth = await authorizeVoiceWebhook(request);
  if (auth === "no_secret") return voiceWebhookNoSecretResponse();
  if (auth === "bad") return voiceWebhookUnauthorizedResponse();

  let body: SearchSupervaluProductsBody;
  try {
    body = (await request.json()) as SearchSupervaluProductsBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const calledNumberRaw = String(body.called_number ?? "").trim();
  if (!calledNumberRaw) {
    return NextResponse.json(
      { ok: false, error: "called_number is required" },
      { status: 400 },
    );
  }

  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { ok: false, error: "query is required" },
      { status: 400 },
    );
  }
  if (query.length > SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        error: `query must be at most ${SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS} characters`,
      },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server configuration error",
      },
      { status: 503 },
    );
  }

  const calledE164 =
    normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
  const { data: phoneRow, error: phoneErr } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", calledE164)
    .maybeSingle();

  if (phoneErr) {
    console.error("[voice/search-supervalu-products] phone lookup", phoneErr);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!phoneRow?.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: `called_number ${calledE164} is not assigned to any organization`,
      },
      { status: 404 },
    );
  }

  const orgId = phoneRow.organization_id as string;

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("is_active, niche, retail_banner, offers_synced_at, retail_source_store_id, catalog_synced_at")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr) {
    console.error("[voice/search-supervalu-products] org lookup", orgErr);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!orgRow?.is_active) {
    return NextResponse.json(
      { ok: false, code: "org_suspended", error: "Organization is not active" },
      { status: 403 },
    );
  }
  if (String(orgRow.niche ?? "") !== "retail") {
    return NextResponse.json(
      { ok: false, error: "Catalog lookup is only available for retail orgs" },
      { status: 403 },
    );
  }
  const retailBanner = String(orgRow.retail_banner ?? "").trim();
  if (retailBanner !== "supervalu") {
    return NextResponse.json(
      { ok: false, error: "Catalog lookup is not enabled for this banner" },
      { status: 403 },
    );
  }

  const intent =
    body.intent === "offer" || body.intent === "price" || body.intent === "stock"
      ? body.intent
      : inferCatalogSearchIntent(query);

  const fulfilment: SupervaluFulfilment | null =
    body.fulfilment === "counter" || body.fulfilment === "prepack"
      ? body.fulfilment
      : inferWeeklyOfferFulfilmentFromQuery(query);

  const latestOfferWeekEnd = await loadLatestRetailOfferWeekEnd(admin, retailBanner);
  const offersFreshness = assessSyncedOffersFreshness({
    syncedAt:
      typeof orgRow.offers_synced_at === "string" ? orgRow.offers_synced_at : null,
    offerWeekEnd: latestOfferWeekEnd,
  });

  const sourceStoreId =
    String(orgRow.retail_source_store_id ?? "").trim() || null;

  const { matches, ownBrandFallbackQuote } = await searchSupervaluCatalogLiveWithFallback(
    query,
    {
      intent,
      supabase: admin,
      retailBanner,
      fulfilment,
      storeId: sourceStoreId ?? undefined,
    },
  );

  const mappedMatches = matches.map((match) => ({
    product_name: match.productName,
    department: match.department,
    sku: match.sku,
    current_price_eur: match.currentPriceEur,
    was_price_eur: match.wasPriceEur,
    discount_label: match.discountLabel,
    is_on_offer: match.isOnOffer,
    service_area: match.serviceArea ?? null,
    fulfilment: match.fulfilment ?? null,
    is_alcohol: match.isAlcohol === true,
    score: match.score,
    quote_text: match.quoteText,
    source: match.source ?? null,
  }));
  const { clarificationHint, matches: responseMatches } = resolveProductSearchResponse(
    query,
    mappedMatches,
    { fulfilment },
  );

  let noMatchQuote: string | null =
    mappedMatches.length === 0
      ? ownBrandFallbackQuote ?? formatCatalogStockNoMatchQuote(query)
      : null;

  if (
    responseMatches.length === 0 &&
    fulfilment &&
    intent === "offer" &&
    offerSearchProductTokens(query).length > 0
  ) {
    const alternateFulfilment: SupervaluFulfilment =
      fulfilment === "counter" ? "prepack" : "counter";
    const { matches: alternateRaw } = await searchSupervaluCatalogLiveWithFallback(query, {
      intent,
      supabase: admin,
      retailBanner,
      fulfilment: alternateFulfilment,
      storeId: sourceStoreId ?? undefined,
    });
    const alternateMapped = alternateRaw.map((match) => ({
      product_name: match.productName,
      department: match.department,
      sku: match.sku,
      current_price_eur: match.currentPriceEur,
      was_price_eur: match.wasPriceEur,
      discount_label: match.discountLabel,
      is_on_offer: match.isOnOffer,
      service_area: match.serviceArea ?? null,
      fulfilment: match.fulfilment ?? null,
      is_alcohol: match.isAlcohol === true,
      score: match.score,
      quote_text: match.quoteText,
      source: match.source ?? null,
    }));
    const { matches: alternateMatches } = resolveProductSearchResponse(query, alternateMapped, {
      fulfilment: alternateFulfilment,
    });
    noMatchQuote = formatOfferFulfilmentMissQuote({
      query,
      requestedFulfilment: fulfilment,
      alternateMatches: alternateMatches.map((match) => ({
        quoteText: match.quote_text,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    intent,
    fulfilment,
    clarification_hint: clarificationHint,
    offers_freshness: offersFreshness.stale ? offersFreshness.message : null,
    matches: responseMatches,
    no_match_quote: noMatchQuote,
  });
}
