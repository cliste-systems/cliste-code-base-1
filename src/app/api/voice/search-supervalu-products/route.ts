import { NextResponse } from "next/server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import {
  formatCatalogStockNoMatchQuote,
  searchSupervaluCatalogLive,
  SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS,
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
};

/**
 * Voice worker: live SuperValu catalog search for stock/range questions.
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
    .select("is_active, niche, retail_banner")
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

  const matches = await searchSupervaluCatalogLive(query);

  return NextResponse.json({
    ok: true,
    matches: matches.map((match) => ({
      product_name: match.productName,
      department: match.department,
      sku: match.sku,
      score: match.score,
      quote_text: match.quoteText,
    })),
    no_match_quote: matches.length === 0 ? formatCatalogStockNoMatchQuote(query) : null,
  });
}
