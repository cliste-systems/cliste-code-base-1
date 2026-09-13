import type { SupabaseClient } from "@supabase/supabase-js";

import type { RetailWeeklyOfferRow } from "@/lib/supervalu-offers-types";

export const RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS = 120;
export const RETAIL_WEEKLY_OFFERS_SEARCH_MAX_RESULTS = 5;
export const RETAIL_WEEKLY_OFFERS_PROMPT_MAX_ITEMS = 12;

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "is",
  "it",
  "do",
  "you",
  "we",
  "i",
  "me",
  "my",
  "your",
  "how",
  "much",
  "what",
  "about",
  "with",
  "from",
  "that",
  "this",
  "are",
  "be",
  "can",
  "have",
  "has",
  "does",
  "did",
  "will",
  "would",
  "please",
  "cost",
  "price",
  "offer",
  "offers",
  "special",
  "week",
  "today",
  "stock",
  "sell",
  "yous",
  "ye",
  "got",
]);

export function tokenizeSupervaluSearchQuery(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 1 && !STOPWORDS.has(token)),
    ),
  ];
}

export function scoreSupervaluSearchText(
  searchText: string,
  tokens: string[],
  department: string,
): number {
  if (tokens.length === 0) return 0;
  let score = 0;
  for (const token of tokens) {
    if (searchText.includes(token)) score += 1;
  }
  if (/butcher|beef|meat|steak|striploin|lamb|poultry|chicken/i.test(department)) {
    score += 0.15;
  }
  return score / tokens.length;
}

function queryTokens(query: string): string[] {
  return tokenizeSupervaluSearchQuery(query);
}

function scoreOffer(
  searchText: string,
  tokens: string[],
  department: string,
): number {
  return scoreSupervaluSearchText(searchText, tokens, department);
}

export type WeeklyOfferMatch = {
  id: string;
  productName: string;
  department: string;
  currentPriceEur: number;
  wasPriceEur: number | null;
  discountLabel: string | null;
  pricePerUnit: string | null;
  score: number;
  quoteText: string;
};

export function formatWeeklyOfferQuote(input: {
  productName: string;
  currentPriceEur: number;
  wasPriceEur?: number | null;
  discountLabel?: string | null;
  pricePerUnit?: string | null;
}): string {
  const price = `€${input.currentPriceEur.toFixed(2)}`;
  const parts = [`${input.productName} is on offer this week at ${price}`];
  if (input.wasPriceEur && input.wasPriceEur > input.currentPriceEur) {
    parts.push(`was €${input.wasPriceEur.toFixed(2)}`);
  }
  if (input.discountLabel?.trim()) {
    parts.push(input.discountLabel.trim());
  }
  if (input.pricePerUnit?.trim()) {
    parts.push(input.pricePerUnit.trim());
  }
  return parts.join(" — ");
}

function rowToMatch(row: RetailWeeklyOfferRow, score: number): WeeklyOfferMatch {
  return {
    id: row.id,
    productName: row.product_name,
    department: row.department,
    currentPriceEur: Number(row.current_price_eur),
    wasPriceEur:
      row.was_price_eur == null ? null : Number(row.was_price_eur),
    discountLabel: row.discount_label,
    pricePerUnit: row.price_per_unit,
    score,
    quoteText: formatWeeklyOfferQuote({
      productName: row.product_name,
      currentPriceEur: Number(row.current_price_eur),
      wasPriceEur:
        row.was_price_eur == null ? null : Number(row.was_price_eur),
      discountLabel: row.discount_label,
      pricePerUnit: row.price_per_unit,
    }),
  };
}

export async function loadRetailWeeklyOffersForBanner(
  supabase: SupabaseClient,
  retailBanner: string,
): Promise<RetailWeeklyOfferRow[]> {
  const { data, error } = await supabase
    .from("retail_weekly_offers")
    .select("*")
    .eq("retail_banner", retailBanner)
    .order("department", { ascending: true })
    .order("product_name", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []) as RetailWeeklyOfferRow[];
}

export async function searchRetailWeeklyOffers(
  supabase: SupabaseClient,
  retailBanner: string,
  query: string,
): Promise<WeeklyOfferMatch[]> {
  const trimmed = query.trim().slice(0, RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS);
  if (!trimmed) return [];

  const rows = await loadRetailWeeklyOffersForBanner(supabase, retailBanner);
  const tokens = queryTokens(trimmed);
  if (tokens.length === 0) return [];

  return rows
    .map((row) => ({
      row,
      score: scoreOffer(row.search_text, tokens, row.department),
    }))
    .filter((entry) => entry.score >= 0.5)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.row.product_name.localeCompare(b.row.product_name),
    )
    .slice(0, RETAIL_WEEKLY_OFFERS_SEARCH_MAX_RESULTS)
    .map((entry) => rowToMatch(entry.row, entry.score));
}

export function buildRetailWeeklyOffersPromptSection(input: {
  offers: RetailWeeklyOfferRow[];
  syncedAt: string | null;
}): string | null {
  if (input.offers.length === 0) return null;

  const syncedLabel = input.syncedAt
    ? new Date(input.syncedAt).toLocaleString("en-IE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Dublin",
      })
    : "recently";

  const lines = input.offers
    .slice(0, RETAIL_WEEKLY_OFFERS_PROMPT_MAX_ITEMS)
    .map((offer) => {
      const price = `€${Number(offer.current_price_eur).toFixed(2)}`;
      const was =
        offer.was_price_eur != null
          ? ` (was €${Number(offer.was_price_eur).toFixed(2)})`
          : "";
      const label = offer.discount_label ? ` — ${offer.discount_label}` : "";
      return `• ${offer.product_name} (${offer.department}): ${price}${was}${label}`;
    });

  return [
    "This week's SuperValu meat offers (synced " + syncedLabel + "):",
    ...lines,
    "Use search_weekly_offers for a specific product question — quote only what it returns.",
  ].join("\n");
}
