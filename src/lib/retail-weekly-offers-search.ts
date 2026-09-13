import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  RetailWeeklyOfferRow,
  SupervaluOfferChannel,
} from "@/lib/supervalu-offers-types";
import {
  formatSpokenDiscountLabel,
  formatSpokenEurAmount,
  speakEmbeddedEurAmounts,
} from "@/lib/spoken-eur-price";

/** Caller wants a rundown of synced offers, not one specific product. */
export function inferWeeklyOffersListIntent(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (
    /\bweekly offers\b|\bwhat offers\b|\bwhat'?s on offer\b|\bwhats on offer\b|\bbest offer|\blist offers\b|\blist (?:five|5|\d+)\b|\bany offers\b|\boffers (?:this week|do you have|you have|on)\b|\bsurprise me\b|\bhighlights\b|\btell me (?:the|your) offers\b|\bapart from meat\b|\bnot meat\b|\bgrocery offers\b|\bwhat (?:meat )?offers\b|\b(?:meat|butcher) offers\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  const tokens = queryTokens(trimmed);
  if (tokens.length === 0 && /\boffer/i.test(trimmed)) return true;
  if (
    tokens.length === 1 &&
    /^(meat|butcher|deli|offers?|promos?|grocery)$/i.test(tokens[0] ?? "")
  ) {
    return true;
  }
  if (tokens.length >= 2 && inferWeeklyOffersBrowseCategories(trimmed).length >= 2) {
    return true;
  }
  return false;
}

export function inferWeeklyOffersExcludeMeat(query: string): boolean {
  return /\bapart from meat\b|\bnot meat\b|\bgrocery offers\b|\bnon[- ]meat\b/i.test(
    query.trim(),
  );
}

export function inferWeeklyOffersBrowseCategories(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  const tokens = tokenizeSupervaluSearchQuery(trimmed);
  const categoryHints = new Set([
    "milk",
    "bread",
    "crisps",
    "chocolate",
    "fruit",
    "yogurt",
    "cheese",
    "butter",
    "tea",
    "coffee",
    "biscuits",
    "sweets",
    "confectionery",
    "drinks",
    "household",
    "frozen",
  ]);
  const fromTokens = tokens.filter((token) => categoryHints.has(token));
  if (fromTokens.length >= 2) return fromTokens.slice(0, 5);
  if (/confectionery|sweets|candy/.test(trimmed)) return ["chocolate", "sweets"];
  if (inferWeeklyOffersExcludeMeat(trimmed)) {
    return ["chocolate", "crisps", "yogurt", "bread", "fruit"];
  }
  if (
    /\blist\b|\bfive\b|\b5\b|weekly offers|best deal|sample|highlights/i.test(
      trimmed,
    )
  ) {
    return ["chocolate", "crisps", "yogurt", "bread", "fruit"];
  }
  return [];
}

function browseRetailWeeklyOffers(
  rows: RetailWeeklyOfferRow[],
  categories: string[],
  limit: number,
  options?: { excludeMeat?: boolean },
): WeeklyOfferMatch[] {
  const seen = new Set<string>();
  const matches: WeeklyOfferMatch[] = [];

  for (const category of categories) {
    const tokens = queryTokens(category);
    if (tokens.length === 0) continue;
    const categoryMatches = rows
      .filter((row) => {
        if (options?.excludeMeat && row.offer_channel !== "grocery") return false;
        return scoreOffer(row.search_text, tokens, row.department) >= 0.5;
      })
      .sort(
        (a, b) =>
          scoreOffer(b.search_text, tokens, b.department) -
            scoreOffer(a.search_text, tokens, a.department) ||
          a.product_name.localeCompare(b.product_name),
      );

    for (const row of categoryMatches) {
      const key = row.sku ?? row.product_name;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(rowToMatch(row, 1));
      if (matches.length >= limit) return matches;
    }
  }

  return matches;
}

function sampleRetailWeeklyOffersAcrossDepartments(
  rows: RetailWeeklyOfferRow[],
  limit: number,
  options?: { excludeMeat?: boolean; channel?: SupervaluOfferChannel | null },
): WeeklyOfferMatch[] {
  const filtered = rows.filter((row) => {
    if (options?.excludeMeat && row.offer_channel !== "grocery") return false;
    if (options?.channel && (row.offer_channel ?? "prepack") !== options.channel) {
      return false;
    }
    return true;
  });
  const byDepartment = new Map<string, RetailWeeklyOfferRow[]>();
  for (const row of filtered) {
    const bucket = byDepartment.get(row.department) ?? [];
    bucket.push(row);
    byDepartment.set(row.department, bucket);
  }
  const departments = [...byDepartment.keys()].sort();
  const matches: WeeklyOfferMatch[] = [];
  while (matches.length < limit && departments.some((dept) => (byDepartment.get(dept)?.length ?? 0) > 0)) {
    for (const dept of departments) {
      const bucket = byDepartment.get(dept);
      const row = bucket?.shift();
      if (!row) continue;
      matches.push(rowToMatch(row, 1));
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function listRetailWeeklyOffers(
  rows: RetailWeeklyOfferRow[],
  channel: SupervaluOfferChannel | null | undefined,
  limit: number,
): WeeklyOfferMatch[] {
  return rows
    .filter((row) => !channel || (row.offer_channel ?? "prepack") === channel)
    .slice(0, limit)
    .map((row, index) => rowToMatch(row, 1 - index * 0.01));
}

export const RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS = 120;
export const RETAIL_WEEKLY_OFFERS_SEARCH_MAX_RESULTS = 5;
export const RETAIL_WEEKLY_OFFERS_LIST_MAX_RESULTS = 12;
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
  offerChannel: SupervaluOfferChannel;
  currentPriceEur: number;
  wasPriceEur: number | null;
  discountLabel: string | null;
  pricePerUnit: string | null;
  score: number;
  quoteText: string;
};

/** Infer whether the caller means the fresh butcher counter or pre-pack aisle. */
export function inferWeeklyOfferChannelFromQuery(
  query: string,
): SupervaluOfferChannel | null {
  const q = query.toLowerCase();
  if (/butcher|meat counter|the counter|fresh counter|butchers/i.test(q)) {
    return "butcher_counter";
  }
  if (/pre\s*-?\s*pack|packaged|quick fry|meat aisle|chilled aisle/i.test(q)) {
    return "prepack";
  }
  return null;
}

export function formatWeeklyOfferQuote(input: {
  productName: string;
  offerChannel?: SupervaluOfferChannel;
  currentPriceEur: number;
  wasPriceEur?: number | null;
  discountLabel?: string | null;
  pricePerUnit?: string | null;
}): string {
  const price = formatSpokenEurAmount(input.currentPriceEur);
  const channelPrefix =
    input.offerChannel === "prepack"
      ? "In the pre-pack meat aisle this week — "
      : input.offerChannel === "butcher_counter"
        ? "At the butcher counter this week — "
        : input.offerChannel === "grocery"
          ? "This week on the SuperValu national range — "
          : "";
  const parts = [`${channelPrefix}${input.productName} is on offer this week at ${price}`];
  if (input.wasPriceEur && input.wasPriceEur > input.currentPriceEur) {
    parts.push(`was ${formatSpokenEurAmount(input.wasPriceEur)}`);
  }
  const spokenLabel = formatSpokenDiscountLabel(input.discountLabel);
  if (spokenLabel) {
    parts.push(spokenLabel);
  }
  if (input.pricePerUnit?.trim()) {
    parts.push(speakEmbeddedEurAmounts(input.pricePerUnit.trim()));
  }
  return parts.join(" — ");
}

function rowToMatch(row: RetailWeeklyOfferRow, score: number): WeeklyOfferMatch {
  const offerChannel = row.offer_channel ?? "prepack";
  return {
    id: row.id,
    productName: row.product_name,
    department: row.department,
    offerChannel,
    currentPriceEur: Number(row.current_price_eur),
    wasPriceEur:
      row.was_price_eur == null ? null : Number(row.was_price_eur),
    discountLabel: row.discount_label,
    pricePerUnit: row.price_per_unit,
    score,
    quoteText: formatWeeklyOfferQuote({
      productName: row.product_name,
      offerChannel,
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
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as RetailWeeklyOfferRow[];
}

export async function searchRetailWeeklyOffers(
  supabase: SupabaseClient,
  retailBanner: string,
  query: string,
  options?: { channel?: SupervaluOfferChannel | null },
): Promise<WeeklyOfferMatch[]> {
  const trimmed = query.trim().slice(0, RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS);
  if (!trimmed) return [];

  const rows = await loadRetailWeeklyOffersForBanner(supabase, retailBanner);
  const channel = options?.channel ?? inferWeeklyOfferChannelFromQuery(trimmed);
  const excludeMeat = inferWeeklyOffersExcludeMeat(trimmed);
  const listIntent = inferWeeklyOffersListIntent(trimmed);
  const browseCategories =
    listIntent ? inferWeeklyOffersBrowseCategories(trimmed) : [];

  if (listIntent) {
    if (browseCategories.length >= 2) {
      const browseMatches = browseRetailWeeklyOffers(
        rows,
        browseCategories,
        RETAIL_WEEKLY_OFFERS_LIST_MAX_RESULTS,
        { excludeMeat },
      );
      if (browseMatches.length > 0) return browseMatches;
    }
    if (excludeMeat) {
      return sampleRetailWeeklyOffersAcrossDepartments(
        rows,
        RETAIL_WEEKLY_OFFERS_LIST_MAX_RESULTS,
        { excludeMeat: true, channel },
      );
    }
    return listRetailWeeklyOffers(rows, channel, RETAIL_WEEKLY_OFFERS_LIST_MAX_RESULTS);
  }

  const tokens = queryTokens(trimmed);
  if (tokens.length === 0) return [];

  return rows
    .filter((row) => {
      if (excludeMeat && row.offer_channel !== "grocery") return false;
      return !channel || (row.offer_channel ?? "prepack") === channel;
    })
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

  const sampled = sampleRetailWeeklyOffersAcrossDepartments(
    input.offers,
    RETAIL_WEEKLY_OFFERS_PROMPT_MAX_ITEMS,
  );

  const lines = sampled.map((offer) => {
    const price = formatSpokenEurAmount(offer.currentPriceEur);
    const was =
      offer.wasPriceEur != null
        ? ` (was ${formatSpokenEurAmount(offer.wasPriceEur)})`
        : "";
    const label = offer.discountLabel
      ? ` — ${formatSpokenDiscountLabel(offer.discountLabel) ?? offer.discountLabel}`
      : "";
    return `• ${offer.productName} (${offer.department}): ${price}${was}${label}`;
  });

  return [
    "This week's SuperValu offers (synced " + syncedLabel + ", " + input.offers.length + " promos):",
    ...lines,
    "Use searchWeeklyOffers for offer/price questions — quote only what it returns.",
  ].join("\n");
}
