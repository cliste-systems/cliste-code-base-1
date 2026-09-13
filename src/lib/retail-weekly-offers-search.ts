import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  RetailWeeklyOfferRow,
  SupervaluFulfilment,
  SupervaluOfferChannel,
  SupervaluServiceArea,
} from "@/lib/supervalu-offers-types";
import {
  formatSpokenDiscountLabel,
  formatSpokenEurAmount,
  speakEmbeddedEurAmounts,
} from "@/lib/spoken-eur-price";

export type WeeklyOfferSearchFilters = {
  channel?: SupervaluOfferChannel | null;
  serviceArea?: SupervaluServiceArea | null;
  fulfilment?: SupervaluFulfilment | null;
};

/** Caller wants a rundown of synced offers, not one specific product. */
export function inferWeeklyOffersListIntent(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (
    /\bweekly offers\b|\bwhat offers\b|\bwhat'?s on offer\b|\bwhats on offer\b|\bbest offer|\blist offers\b|\blist (?:five|5|\d+)\b|\bany offers\b|\boffers (?:this week|do you have|you have|on)\b|\bsurprise me\b|\bhighlights\b|\btell me (?:the|your) offers\b|\bapart from meat\b|\bnot meat\b|\bgrocery offers\b|\bwhat (?:meat )?offers\b|\b(?:meat|butcher|deli|wine|beer) offers\b|\boff[- ]licence offers\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  const tokens = queryTokens(trimmed);
  if (tokens.length === 0 && /\boffer/i.test(trimmed)) return true;
  if (
    tokens.length === 1 &&
    /^(meat|butcher|deli|offers?|promos?|grocery|wine|beer)$/i.test(tokens[0] ?? "")
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
    "ham",
    "wine",
    "beer",
    "potatoes",
  ]);
  const fromTokens = tokens.filter((token) => categoryHints.has(token));
  if (fromTokens.length >= 2) return fromTokens.slice(0, 5);
  if (/deli|ham|cooked meat/i.test(trimmed)) return ["ham", "salami"];
  if (/wine|beer|off[- ]licence|spirits/i.test(trimmed)) return ["wine", "beer"];
  if (/butcher|meat counter/i.test(trimmed)) return ["striploin", "rashers", "sausages"];
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

export function inferWeeklyOfferServiceAreaFromQuery(
  query: string,
): SupervaluServiceArea | null {
  const q = query.toLowerCase();
  if (/off[- ]licence|wine|beer|spirits|cider/i.test(q)) return "off_licence";
  if (/deli|carrolls|sliced ham|cooked meat|salami|charcuterie/i.test(q)) return "deli";
  if (/butcher|meat counter|striploin|sirloin|steak|rashers|sausages/i.test(q)) {
    return "butcher";
  }
  if (/fruit|veg|vegetable|potato|apple|produce/i.test(q)) return "produce";
  if (/bakery|croissant|scone|baguette/i.test(q)) return "bakery";
  return null;
}

export function inferWeeklyOfferFulfilmentFromQuery(
  query: string,
): SupervaluFulfilment | null {
  const q = query.toLowerCase();
  if (/pre\s*-?\s*pack|packaged|quick fry|meat aisle|chilled aisle|pack\b/i.test(q)) {
    return "prepack";
  }
  if (/butcher counter|deli counter|the counter|fresh sliced|per kilo|per kg|loose/i.test(q)) {
    return "counter";
  }
  if (/fruit|veg|produce/i.test(q) && /fresh counter|loose/i.test(q)) {
    return "counter";
  }
  if (/butcher|butchers|meat counter/i.test(q)) return "counter";
  if (/deli/i.test(q) && !/pre\s*-?\s*pack|packaged|chilled aisle/i.test(q)) {
    return "counter";
  }
  return null;
}

/** Legacy channel inference — maps to service_area/fulfilment where possible. */
export function inferWeeklyOfferChannelFromQuery(
  query: string,
): SupervaluOfferChannel | null {
  const serviceArea = inferWeeklyOfferServiceAreaFromQuery(query);
  const fulfilment = inferWeeklyOfferFulfilmentFromQuery(query);
  if (serviceArea === "butcher" && fulfilment === "counter") return "butcher_counter";
  if (serviceArea === "butcher" && fulfilment === "prepack") return "prepack";
  if (serviceArea === "deli" && fulfilment === "counter") return "butcher_counter";
  if (serviceArea === "deli" && fulfilment === "prepack") return "prepack";
  if (/butcher|meat counter|the counter|butchers/i.test(query.toLowerCase())) {
    return "butcher_counter";
  }
  if (/pre\s*-?\s*pack|packaged|quick fry|meat aisle|chilled aisle/i.test(query.toLowerCase())) {
    return "prepack";
  }
  return null;
}

export function resolveWeeklyOfferSearchFilters(
  query: string,
  explicit?: WeeklyOfferSearchFilters,
): WeeklyOfferSearchFilters {
  const channel =
    explicit?.channel ??
    inferWeeklyOfferChannelFromQuery(query);
  return {
    channel,
    serviceArea: explicit?.serviceArea ?? inferWeeklyOfferServiceAreaFromQuery(query),
    fulfilment: explicit?.fulfilment ?? inferWeeklyOfferFulfilmentFromQuery(query),
  };
}

function rowMatchesFilters(
  row: RetailWeeklyOfferRow,
  filters: WeeklyOfferSearchFilters,
  options?: { excludeMeat?: boolean },
): boolean {
  if (options?.excludeMeat && row.service_area !== "grocery") return false;
  if (filters.serviceArea && row.service_area !== filters.serviceArea) return false;
  if (filters.fulfilment && row.fulfilment !== filters.fulfilment) return false;
  if (filters.channel && (row.offer_channel ?? "prepack") !== filters.channel) {
    return false;
  }
  return true;
}

function browseRetailWeeklyOffers(
  rows: RetailWeeklyOfferRow[],
  categories: string[],
  limit: number,
  options?: { excludeMeat?: boolean; filters?: WeeklyOfferSearchFilters },
): WeeklyOfferMatch[] {
  const seen = new Set<string>();
  const matches: WeeklyOfferMatch[] = [];
  const filters = options?.filters ?? {};

  for (const category of categories) {
    const tokens = queryTokens(category);
    if (tokens.length === 0) continue;
    const categoryMatches = rows
      .filter((row) => {
        if (!rowMatchesFilters(row, filters, options)) return false;
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
  options?: { excludeMeat?: boolean; filters?: WeeklyOfferSearchFilters },
): WeeklyOfferMatch[] {
  const filters = options?.filters ?? {};
  const filtered = rows.filter((row) =>
    rowMatchesFilters(row, filters, options),
  );
  const byDepartment = new Map<string, RetailWeeklyOfferRow[]>();
  for (const row of filtered) {
    const bucketKey = `${row.service_area}:${row.department}`;
    const bucket = byDepartment.get(bucketKey) ?? [];
    bucket.push(row);
    byDepartment.set(bucketKey, bucket);
  }
  const departments = [...byDepartment.keys()].sort();
  const matches: WeeklyOfferMatch[] = [];
  while (
    matches.length < limit &&
    departments.some((dept) => (byDepartment.get(dept)?.length ?? 0) > 0)
  ) {
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
  filters: WeeklyOfferSearchFilters,
  limit: number,
): WeeklyOfferMatch[] {
  return rows
    .filter((row) => rowMatchesFilters(row, filters))
    .slice(0, limit)
    .map((row, index) => rowToMatch(row, 1 - index * 0.01));
}

export const RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS = 120;
export const RETAIL_WEEKLY_OFFERS_SEARCH_MAX_RESULTS = 5;
export const RETAIL_WEEKLY_OFFERS_LIST_MAX_RESULTS = 16;
export const RETAIL_WEEKLY_OFFERS_PROMPT_MAX_ITEMS = 16;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "at", "is", "it",
  "do", "you", "we", "i", "me", "my", "your", "how", "much", "what", "about",
  "with", "from", "that", "this", "are", "be", "can", "have", "has", "does",
  "did", "will", "would", "please", "cost", "price", "offer", "offers",
  "special", "week", "today", "stock", "sell", "yous", "ye", "got",
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
  if (/butcher|beef|meat|steak|striploin|lamb|poultry|chicken|deli|ham/i.test(department)) {
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
  serviceArea: SupervaluServiceArea;
  fulfilment: SupervaluFulfilment;
  currentPriceEur: number;
  wasPriceEur: number | null;
  discountLabel: string | null;
  pricePerUnit: string | null;
  isAlcohol: boolean;
  score: number;
  quoteText: string;
};

function quoteUsesPerKilo(input: {
  priceUnitType?: string | null;
  sellBy?: string | null;
  pricePerUnit?: string | null;
  serviceArea?: SupervaluServiceArea;
  fulfilment?: SupervaluFulfilment;
}): boolean {
  const unitType = String(input.priceUnitType ?? "").toLowerCase();
  const sellBy = String(input.sellBy ?? "").toLowerCase();
  if (unitType === "kilogram") return true;
  if (sellBy === "unit" || sellBy === "weight") return true;
  if (
    input.fulfilment === "counter" &&
    /\/kg/i.test(String(input.pricePerUnit ?? ""))
  ) {
    return true;
  }
  if (
    (input.serviceArea === "butcher" || input.serviceArea === "deli") &&
    input.fulfilment === "counter"
  ) {
    return true;
  }
  return false;
}

export function formatWeeklyOfferQuote(input: {
  productName: string;
  offerChannel?: SupervaluOfferChannel;
  serviceArea?: SupervaluServiceArea;
  fulfilment?: SupervaluFulfilment;
  currentPriceEur: number;
  wasPriceEur?: number | null;
  discountLabel?: string | null;
  pricePerUnit?: string | null;
  priceUnitType?: string | null;
  sellBy?: string | null;
  isAlcohol?: boolean;
}): string {
  const serviceArea = input.serviceArea ?? "grocery";
  const fulfilment = input.fulfilment ?? "prepack";
  const perKilo = quoteUsesPerKilo(input);
  const price = formatSpokenEurAmount(input.currentPriceEur);

  let channelPrefix = "This week on the SuperValu national range — ";
  if (serviceArea === "butcher" && fulfilment === "counter") {
    channelPrefix = "At the butcher counter this week — ";
  } else if (serviceArea === "butcher" && fulfilment === "prepack") {
    channelPrefix = "In the pre-pack meat aisle this week — ";
  } else if (serviceArea === "deli" && fulfilment === "counter") {
    channelPrefix = "At the deli counter this week — ";
  } else if (serviceArea === "deli" && fulfilment === "prepack") {
    channelPrefix = "In the chilled aisle this week — ";
  } else if (serviceArea === "produce" && fulfilment === "counter") {
    channelPrefix = "At the fruit and veg counter this week — ";
  } else if (serviceArea === "bakery" && fulfilment === "counter") {
    channelPrefix = "At the in-store bakery counter this week — ";
  } else if (serviceArea === "off_licence") {
    channelPrefix = "On the off-licence range this week — ";
  } else if (input.offerChannel === "prepack") {
    channelPrefix = "In the pre-pack meat aisle this week — ";
  } else if (input.offerChannel === "butcher_counter") {
    channelPrefix = "At the butcher counter this week — ";
  }

  const pricePhrase = perKilo
    ? `${input.productName} is on offer at ${price} per kilo`
    : `${input.productName} is on offer this week at ${price}`;

  const parts = [`${channelPrefix}${pricePhrase}`];

  if (input.wasPriceEur && input.wasPriceEur > input.currentPriceEur) {
    const was = formatSpokenEurAmount(input.wasPriceEur);
    parts.push(perKilo ? `was ${was} per kilo` : `was ${was}`);
  }

  const spokenLabel = formatSpokenDiscountLabel(input.discountLabel);
  if (spokenLabel) parts.push(spokenLabel);

  if (
    !perKilo &&
    input.pricePerUnit?.trim() &&
    /\/kg/i.test(input.pricePerUnit)
  ) {
    parts.push(speakEmbeddedEurAmounts(input.pricePerUnit.trim()));
  } else if (perKilo && input.pricePerUnit?.trim() && !/per kilo/i.test(parts.join(" "))) {
    parts.push(speakEmbeddedEurAmounts(input.pricePerUnit.trim()));
  }

  return parts.join(" — ");
}

function rowToMatch(row: RetailWeeklyOfferRow, score: number): WeeklyOfferMatch {
  const offerChannel = row.offer_channel ?? "prepack";
  const serviceArea = row.service_area ?? "grocery";
  const fulfilment = row.fulfilment ?? "prepack";
  return {
    id: row.id,
    productName: row.product_name,
    department: row.department,
    offerChannel,
    serviceArea,
    fulfilment,
    currentPriceEur: Number(row.current_price_eur),
    wasPriceEur:
      row.was_price_eur == null ? null : Number(row.was_price_eur),
    discountLabel: row.discount_label,
    pricePerUnit: row.price_per_unit,
    isAlcohol: row.is_alcohol === true,
    score,
    quoteText: formatWeeklyOfferQuote({
      productName: row.product_name,
      offerChannel,
      serviceArea,
      fulfilment,
      currentPriceEur: Number(row.current_price_eur),
      wasPriceEur:
        row.was_price_eur == null ? null : Number(row.was_price_eur),
      discountLabel: row.discount_label,
      pricePerUnit: row.price_per_unit,
      priceUnitType: row.price_unit_type,
      sellBy: row.sell_by,
      isAlcohol: row.is_alcohol === true,
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
    .order("service_area", { ascending: true })
    .order("department", { ascending: true })
    .order("product_name", { ascending: true })
    .limit(5000);

  if (error) throw new Error(error.message);
  return (data ?? []) as RetailWeeklyOfferRow[];
}

export async function searchRetailWeeklyOffers(
  supabase: SupabaseClient,
  retailBanner: string,
  query: string,
  options?: WeeklyOfferSearchFilters,
): Promise<WeeklyOfferMatch[]> {
  const trimmed = query.trim().slice(0, RETAIL_WEEKLY_OFFERS_SEARCH_MAX_QUERY_CHARS);
  if (!trimmed) return [];

  const rows = await loadRetailWeeklyOffersForBanner(supabase, retailBanner);
  const filters = resolveWeeklyOfferSearchFilters(trimmed, options);
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
        { excludeMeat, filters },
      );
      if (browseMatches.length > 0) return browseMatches;
    }
    if (excludeMeat) {
      return sampleRetailWeeklyOffersAcrossDepartments(
        rows,
        RETAIL_WEEKLY_OFFERS_LIST_MAX_RESULTS,
        { excludeMeat: true, filters },
      );
    }
    return listRetailWeeklyOffers(rows, filters, RETAIL_WEEKLY_OFFERS_LIST_MAX_RESULTS);
  }

  const tokens = queryTokens(trimmed);
  if (tokens.length === 0) return [];

  const matches = rows
    .filter((row) => rowMatchesFilters(row, filters, { excludeMeat }))
    .map((row) => ({
      row,
      score: scoreOffer(row.search_text, tokens, row.department),
    }))
    .filter((entry) => entry.score >= 0.5)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.row.product_name.localeCompare(b.row.product_name),
    );

  const hasCounter = matches.some((m) => m.row.fulfilment === "counter");
  const hasPrepack = matches.some((m) => m.row.fulfilment === "prepack");
  const ambiguousHam =
    !filters.fulfilment &&
    !filters.serviceArea &&
    /ham|steak|meat/i.test(trimmed) &&
    hasCounter &&
    hasPrepack;

  const limit = ambiguousHam
    ? RETAIL_WEEKLY_OFFERS_SEARCH_MAX_RESULTS + 2
    : RETAIL_WEEKLY_OFFERS_SEARCH_MAX_RESULTS;

  return matches.slice(0, limit).map((entry) => rowToMatch(entry.row, entry.score));
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

  const areaCounts: Record<string, number> = {};
  for (const row of input.offers) {
    areaCounts[row.service_area] = (areaCounts[row.service_area] ?? 0) + 1;
  }

  const lines = sampled.map((offer) => {
    const price = formatSpokenEurAmount(offer.currentPriceEur);
    const was =
      offer.wasPriceEur != null
        ? ` (was ${formatSpokenEurAmount(offer.wasPriceEur)})`
        : "";
    const label = offer.discountLabel
      ? ` — ${formatSpokenDiscountLabel(offer.discountLabel) ?? offer.discountLabel}`
      : "";
    return `• ${offer.productName} (${offer.serviceArea}/${offer.fulfilment}): ${price}${was}${label}`;
  });

  return [
    "This week's SuperValu offers (synced " +
      syncedLabel +
      ", " +
      input.offers.length +
      " promos; butcher " +
      (areaCounts.butcher ?? 0) +
      ", deli " +
      (areaCounts.deli ?? 0) +
      ", produce " +
      (areaCounts.produce ?? 0) +
      ", off-licence " +
      (areaCounts.off_licence ?? 0) +
      ", grocery " +
      (areaCounts.grocery ?? 0) +
      "):",
    ...lines,
    "Use searchWeeklyOffers for offer/price questions — quote only what it returns.",
  ].join("\n");
}
