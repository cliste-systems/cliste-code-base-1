import type { SupabaseClient } from "@supabase/supabase-js";

import { offerSearchProductTokens, scoreSupervaluSearchText } from "@/lib/retail-weekly-offers-search";
import { normalizeSearchText } from "@/lib/supervalu-offers-normalize";
import { retailSearchTokenMatchesText } from "@/lib/retail-search-fuzzy";
import type { SupervaluFulfilment } from "@/lib/supervalu-offers-types";
import {
  formatCatalogStockQuote,
  type CatalogQuoteIntent,
  type SupervaluCatalogMatch,
} from "@/lib/supervalu-catalog-search";

type CatalogRow = {
  id: string;
  sku: string;
  product_name: string;
  brand: string | null;
  department: string;
  category_breadcrumb: string | null;
  service_area: string;
  fulfilment: string;
  is_alcohol: boolean;
  search_text: string;
  retail_store_products: Array<{
    id: string;
    regular_price_eur: number | null;
    display_price_eur: number | null;
    price_per_unit: string | null;
    source_price_label: string | null;
    is_listed: boolean;
    retail_promotions: Array<{
      promotion_type: string;
      loyalty_required: boolean;
      loyalty_program: string | null;
      offer_price_eur: number | null;
      regular_price_eur: number | null;
      label: string | null;
      valid_from: string;
      valid_to: string;
    }>;
  }>;
};

export async function searchStoredRetailCatalog(
  supabase: SupabaseClient,
  input: {
    retailBanner: string;
    sourceStoreId: string;
    query: string;
    intent: CatalogQuoteIntent;
    fulfilment?: SupervaluFulfilment | null;
    limit?: number;
  },
): Promise<SupervaluCatalogMatch[]> {
  const tokens = offerSearchProductTokens(input.query);
  if (tokens.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const broad = tokens[0]!.replace(/s$/, "");
  let query = supabase
    .from("retail_catalog_products")
    .select(
      "id,sku,product_name,brand,department,category_breadcrumb,service_area,fulfilment,is_alcohol,search_text,retail_store_products!inner(id,regular_price_eur,display_price_eur,price_per_unit,source_price_label,is_listed,retail_promotions(promotion_type,loyalty_required,loyalty_program,offer_price_eur,regular_price_eur,label,valid_from,valid_to))",
    )
    .eq("retail_banner", input.retailBanner)
    .eq("retail_store_products.source_store_id", input.sourceStoreId)
    .eq("retail_store_products.is_listed", true)
    .ilike("search_text", `%${broad}%`)
    .limit(80);
  if (input.fulfilment) query = query.eq("fulfilment", input.fulfilment);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as CatalogRow[])
    .map((row) => {
      const listing = row.retail_store_products?.[0];
      if (!listing) return null;
      const activePromos = (listing.retail_promotions ?? []).filter(
        (p) => p.valid_from <= today && p.valid_to >= today,
      );
      const promo = activePromos.find((p) => p.loyalty_required) ?? activePromos[0] ?? null;
      const isOnOffer = promo != null;
      const currentPrice = promo?.offer_price_eur ?? listing.display_price_eur ?? listing.regular_price_eur;
      const regularPrice = promo?.regular_price_eur ?? listing.regular_price_eur;
      const score =
        scoreSupervaluSearchText(
          normalizeSearchText(row.search_text),
          tokens,
          row.department,
        ) + catalogCategoryDirectnessScore(row, tokens);
      const loyaltySuffix = promo?.loyalty_required
        ? ` ${promo.loyalty_program ?? "Loyalty"} required.`
        : "";
      const quoteText =
        formatCatalogStockQuote({
          productName: row.product_name,
          department: row.department,
          currentPriceEur: currentPrice,
          wasPriceEur: isOnOffer ? regularPrice : null,
          discountLabel: promo?.label ?? null,
          pricePerUnit: listing.price_per_unit,
          isOnOffer,
          intent: input.intent,
        }) + loyaltySuffix;
      return {
        productName: row.product_name,
        department: row.department,
        sku: row.sku,
        currentPriceEur: currentPrice,
        wasPriceEur: isOnOffer ? regularPrice : null,
        discountLabel: promo?.label ?? null,
        isOnOffer,
        score,
        quoteText,
        serviceArea: row.service_area,
        fulfilment: row.fulfilment,
        isAlcohol: row.is_alcohol,
        source: "catalog" as const,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v != null && v.score >= 0.5)
    .filter((v) => input.intent !== "offer" || v.isOnOffer)
    .sort((a, b) => b.score - a.score || a.productName.localeCompare(b.productName))
    .slice(0, input.limit ?? 8);
}


type NationalCatalogRow = {
  id: string;
  sku: string;
  product_name: string;
  brand: string | null;
  department: string;
  category_breadcrumb: string | null;
  service_area: string;
  fulfilment: string;
  is_alcohol: boolean;
  search_text: string;
  national_store_count: number;
  national_regular_price_eur: number | null;
};

function catalogCategoryDirectnessScore(
  row: { department: string; category_breadcrumb?: string | null; product_name: string },
  tokens: string[],
): number {
  if (tokens.length === 0) return 0;
  const department = normalizeSearchText(row.department);
  const category = normalizeSearchText(row.category_breadcrumb ?? "");
  const productName = normalizeSearchText(row.product_name);
  let direct = 0;

  for (const token of tokens) {
    if (retailSearchTokenMatchesText(department, token)) {
      direct += 0.65;
      continue;
    }
    if (retailSearchTokenMatchesText(category, token)) {
      direct += 0.45;
      continue;
    }
    // A product whose noun is the actual item should outrank products where the
    // same word is merely an ingredient/flavour (e.g. avocado vs avocado oil).
    if (retailSearchTokenMatchesText(productName, token)) {
      direct += 0.1;
    }
  }

  return direct / tokens.length;
}

export async function searchNationalRetailCatalog(
  supabase: SupabaseClient,
  input: {
    retailBanner: string;
    query: string;
    intent: CatalogQuoteIntent;
    fulfilment?: SupervaluFulfilment | null;
    limit?: number;
  },
): Promise<SupervaluCatalogMatch[]> {
  if (input.intent === "offer") return [];
  const tokens = offerSearchProductTokens(input.query);
  if (tokens.length === 0) return [];

  const candidateTokens = [...tokens]
    .map((token) => token.replace(/s$/, ""))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let candidateRows: NationalCatalogRow[] = [];
  for (const candidate of candidateTokens) {
    let query = supabase
      .from("retail_catalog_products")
      .select(
        "id,sku,product_name,brand,department,category_breadcrumb,service_area,fulfilment,is_alcohol,search_text,national_store_count,national_regular_price_eur",
      )
      .eq("retail_banner", input.retailBanner)
      .eq("is_national", true)
      .gte("national_store_count", 3)
      .ilike("search_text", `%${candidate}%`)
      .limit(80);

    if (input.fulfilment) query = query.eq("fulfilment", input.fulfilment);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if ((data ?? []).length > 0) {
      candidateRows = (data ?? []) as NationalCatalogRow[];
      break;
    }
  }

  return candidateRows
    .map((row) => {
      const score =
        scoreSupervaluSearchText(
          normalizeSearchText(row.search_text),
          tokens,
          row.department,
        ) + catalogCategoryDirectnessScore(row, tokens);
      return {
        productName: row.product_name,
        department: row.department,
        sku: row.sku,
        currentPriceEur: row.national_regular_price_eur,
        wasPriceEur: null,
        discountLabel: null,
        isOnOffer: false,
        score,
        quoteText: formatCatalogStockQuote({
          productName: row.product_name,
          department: row.department,
          currentPriceEur: row.national_regular_price_eur,
          wasPriceEur: null,
          discountLabel: null,
          isOnOffer: false,
          intent: input.intent,
        }),
        serviceArea: row.service_area,
        fulfilment: row.fulfilment,
        isAlcohol: row.is_alcohol,
        source: "catalog" as const,
      };
    })
    .filter((row) => row.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.productName.localeCompare(b.productName))
    .slice(0, input.limit ?? 8);
}
