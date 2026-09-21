import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";

import {
  resolveWeeklyOfferSearchFilters,
  tokenizeSupervaluSearchQuery,
} from "@/lib/retail-weekly-offers-search";
import type {
  SupervaluFulfilment,
  SupervaluServiceArea,
} from "@/lib/supervalu-offers-types";
import {
  formatSpokenDiscountLabel,
  formatSpokenEurAmount,
} from "@/lib/spoken-eur-price";
import type { SupervaluCatalogMatch } from "@/lib/supervalu-catalog-search";

const DUBLIN = "Europe/Dublin";
export const RETAIL_PROMOTION_LIST_MAX_RESULTS = 16;

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
};

const NUMBER_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const PROMOTION_NOISE = new Set([
  "offer",
  "offers",
  "deal",
  "deals",
  "special",
  "specials",
  "promotion",
  "promotions",
  "promo",
  "promos",
  "week",
  "weekly",
  "today",
  "this",
  "what",
  "whats",
  "what's",
  "any",
  "list",
  "show",
  "tell",
  "me",
  "the",
  "are",
  "is",
  "do",
  "you",
  "have",
  "on",
  "in",
  "for",
  "price",
  "prices",
  "rewards",
  "reward",
  "real",
  "members",
  "member",
  "only",
  "save",
  "saving",
  "off",
  "half",
  "buy",
  "mix",
  "match",
  "bundle",
  "value",
]);

const AREA_NOISE = new Set([
  "fruit",
  "veg",
  "vegetable",
  "vegetables",
  "produce",
  "butcher",
  "butchers",
  "meat",
  "fish",
  "seafood",
  "deli",
  "bakery",
  "grocery",
  "dairy",
  "ambient",
  "provisions",
  "frozen",
  "household",
  "wine",
  "beer",
  "spirits",
  "alcohol",
  "counter",
  "prepack",
  "packaged",
  "aisle",
]);

export type RetailPromotionMechanic =
  | "multibuy"
  | "loyalty"
  | "half_price"
  | "save_percent"
  | "save_amount"
  | "fixed_price"
  | "named"
  | "generic";

export type ParsedRetailPromotionQuery = {
  mechanic: RetailPromotionMechanic;
  quantity: number | null;
  totalEur: number | null;
  percent: number | null;
  amountEur: number | null;
  loyaltyRequired: boolean;
  namedPhrase: string | null;
  serviceArea: SupervaluServiceArea | null;
  fulfilment: SupervaluFulfilment | null;
  subjectTokens: string[];
};

function numberValue(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNumberWords(value: string): string {
  let out = value.toLowerCase();

  // Convert compound spoken numbers before single words: "twenty five" -> 25.
  for (const [tensWord, tensValue] of Object.entries(NUMBER_TENS)) {
    for (const [onesWord, onesValue] of Object.entries(NUMBER_WORDS)) {
      const ones = Number(onesValue);
      if (ones < 1 || ones > 9) continue;
      out = out.replace(
        new RegExp(`\\b${tensWord}[ -]${onesWord}\\b`, "gi"),
        String(tensValue + ones),
      );
    }
    out = out.replace(
      new RegExp(`\\b${tensWord}\\b`, "gi"),
      String(tensValue),
    );
  }

  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }

  // Natural Irish/UK retail phrasing should resolve to the same mechanic as
  // badge syntax. Keep these as lexical normalisation, not query-specific
  // business rules, so the promotion engine remains generic.
  out = out
    .replace(/\b(?:a\s+)?tenner\b/gi, "€10")
    .replace(/\b(?:a\s+)?fiver\b/gi, "€5")
    .replace(/\b([0-9]+(?:[.,][0-9]{1,2})?)\s+quid\b/gi, "€$1")
    .replace(/\b([0-9]+(?:[.,][0-9]{1,2})?)\s+euros?\b/gi, "€$1")
    .replace(/\b([0-9]{1,2})\s+cents?\b/gi, "$1c")
    .replace(/\bpercent\b/gi, "%")
    .replace(/\s+/g, " ")
    .trim();

  return out;
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMoneyExpression(value: string): number | null {
  const euro = value.match(/€\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (euro) return parseMoney(euro[1]);
  const cents = value.match(/\b([0-9]{1,2})\s*c\b/i);
  if (cents) {
    const amount = Number(cents[1]) / 100;
    return Number.isFinite(amount) ? amount : null;
  }
  const bare = value.match(/\b([0-9]+(?:[.,][0-9]{1,2})?)\b/);
  return bare ? parseMoney(bare[1]) : null;
}

function promotionSubjectTokens(query: string): string[] {
  const normalized = normalizeNumberWords(query)
    .replace(/(?:buy\s+)?\d+\s+for\s+(?:€\s*)?\d+(?:[.,]\d{1,2})?(?:\s*euro)?/gi, " ")
    .replace(/save\s+(?:(?:€\s*)?\d+(?:[.,]\d{1,2})?|\d{1,2}\s*c)/gi, " ")
    .replace(/save\s+\d+(?:[.,]\d+)?\s*%/gi, " ")
    .replace(/\d+(?:[.,]\d+)?\s*%\s*off/gi, " ")
    .replace(/only\s+(?:(?:€\s*)?\d+(?:[.,]\d{1,2})?|\d{1,2}\s*c)/gi, " ")
    .replace(/half\s+price/gi, " ")
    .replace(/super\s*7/gi, " ")
    .replace(/mix\s*(?:&|and)\s*match/gi, " ");

  return tokenizeSupervaluSearchQuery(normalized).filter(
    (token) =>
      !/^\d+(?:\.\d+)?$/.test(token) &&
      !PROMOTION_NOISE.has(token) &&
      !AREA_NOISE.has(token),
  );
}

export function parseRetailPromotionQuery(
  query: string,
): ParsedRetailPromotionQuery {
  const normalized = normalizeNumberWords(query);
  const filters = resolveWeeklyOfferSearchFilters(query);

  const multibuy = normalized.match(
    /(?:buy\s+)?(\d+)\s+for\s+(?:€\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*euro)?\b/i,
  );
  const loyaltyRequired =
    /\breal\s+rewards?\b|\brewards?\s+price\b|\bmembers?\s+(?:price|offer|deal)s?\b/i.test(
      normalized,
    );
  const halfPrice = /\bhalf\s+price\b|\b50\s*%\s*off\b/i.test(normalized);
  const savePercent = normalized.match(
    /(?:\bsave\s+)?(\d+(?:[.,]\d+)?)\s*%\s*(?:off)?/i,
  );
  const saveAmount = normalized.match(
    /\bsave\s+((?:€\s*)?\d+(?:[.,]\d{1,2})?|\d{1,2}\s*c)\b/i,
  );
  const fixedPrice = !multibuy
    ? normalized.match(
        /\bonly\s+((?:€\s*)?\d+(?:[.,]\d{1,2})?|\d{1,2}\s*c)\b/i,
      )
    : null;
  const loyaltyPriceAmount = normalized.match(
    /\brewards?\s+price(?:\s+only)?\s+((?:€\s*)?\d+(?:[.,]\d{1,2})?|\d{1,2}\s*c)\b/i,
  );
  const mixMatch = /\bmix\s*(?:&|and)\s*match\b/i.test(normalized);
  const namedPhrase = /\bsuper\s*7\b/i.test(normalized)
    ? "super 7"
    : /\bbundle\s+offer\b/i.test(normalized)
      ? "bundle offer"
      : /\bbest\s+value\b/i.test(normalized)
        ? "best value"
        : /\bgreat\s+value\b/i.test(normalized)
          ? "great value"
          : null;

  let mechanic: RetailPromotionMechanic = "generic";
  if (multibuy || mixMatch) mechanic = "multibuy";
  else if (halfPrice) mechanic = "half_price";
  else if (savePercent) mechanic = "save_percent";
  else if (saveAmount) mechanic = "save_amount";
  else if (fixedPrice) mechanic = "fixed_price";
  else if (loyaltyRequired) mechanic = "loyalty";
  else if (namedPhrase) mechanic = "named";

  return {
    mechanic,
    quantity: multibuy ? Number(multibuy[1]) : null,
    totalEur: multibuy ? parseMoney(multibuy[2]) : null,
    percent: savePercent ? parseMoney(savePercent[1]) : halfPrice ? 50 : null,
    amountEur: saveAmount
      ? parseMoneyExpression(saveAmount[1])
      : fixedPrice
        ? parseMoneyExpression(fixedPrice[1])
        : loyaltyPriceAmount
          ? parseMoneyExpression(loyaltyPriceAmount[1])
          : null,
    loyaltyRequired,
    namedPhrase,
    serviceArea: filters.serviceArea ?? null,
    fulfilment: filters.fulfilment ?? null,
    subjectTokens: promotionSubjectTokens(query),
  };
}

export function shouldUseStructuredPromotionSearch(query: string): boolean {
  return parseRetailPromotionQuery(query).mechanic !== "generic";
}

function parseLabelMultibuy(
  label: string,
): { quantity: number; totalEur: number } | null {
  const normalized = normalizeNumberWords(label);
  const match = normalized.match(
    /(?:buy\s+)?(\d+)\s+for\s+(?:€\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*euro)?\b/i,
  );
  if (!match) return null;
  const totalEur = parseMoney(match[2]);
  if (totalEur == null) return null;
  return { quantity: Number(match[1]), totalEur };
}

function formatPromotionQuote(input: {
  productName: string;
  label: string | null;
  promotionType: string;
  loyaltyRequired: boolean;
  offerPriceEur: number | null;
  regularPriceEur: number | null;
  displayPriceEur: number | null;
  pricePerUnit: string | null;
}): string {
  const spokenLabel = formatSpokenDiscountLabel(input.label);
  const parts: string[] = [input.productName];

  if (spokenLabel) {
    const alreadyRewards = /rewards?/i.test(spokenLabel);
    parts.push(
      input.loyaltyRequired && !alreadyRewards
        ? `With Real Rewards, ${spokenLabel}`
        : spokenLabel,
    );
  } else if (input.loyaltyRequired && input.offerPriceEur != null) {
    parts.push(
      `With Real Rewards, ${formatSpokenEurAmount(input.offerPriceEur)}`,
    );
  } else if (input.offerPriceEur != null) {
    parts.push(formatSpokenEurAmount(input.offerPriceEur));
  }

  const multibuy =
    input.promotionType === "multibuy" ||
    Boolean(input.label && parseLabelMultibuy(input.label));
  if (multibuy) {
    // The bundle total is the verified mechanic. Individual shelf prices can
    // vary by storefront, so do not turn them into part of the quoted deal.
  } else {
    if (
      input.offerPriceEur != null &&
      input.regularPriceEur != null &&
      input.regularPriceEur > input.offerPriceEur
    ) {
      parts.push(`usually ${formatSpokenEurAmount(input.regularPriceEur)}`);
    }
    if (input.pricePerUnit?.trim()) {
      parts.push(input.pricePerUnit.trim());
    }
  }

  return parts.join(". ") + ".";
}

export async function searchStructuredNationalPromotions(
  supabase: SupabaseClient,
  input: {
    retailBanner: string;
    query: string;
    limit?: number;
  },
): Promise<SupervaluCatalogMatch[]> {
  const parsed = parseRetailPromotionQuery(input.query);
  if (parsed.mechanic === "generic") return [];

  const { data, error } = await supabase.rpc(
    "search_retail_promotions_consensus",
    {
      p_retail_banner: input.retailBanner,
      p_mechanic: parsed.mechanic,
      p_loyalty_required: parsed.loyaltyRequired,
      p_quantity: parsed.quantity,
      p_total_eur: parsed.totalEur,
      p_percent: parsed.percent,
      p_amount_eur: parsed.amountEur,
      p_named_phrase: parsed.namedPhrase,
      p_service_area: parsed.serviceArea,
      p_fulfilment: parsed.fulfilment,
      p_subject_tokens: parsed.subjectTokens,
      p_reference_date: formatInTimeZone(new Date(), DUBLIN, "yyyy-MM-dd"),
      p_limit: Math.max(
        1,
        Math.min(
          input.limit ?? RETAIL_PROMOTION_LIST_MAX_RESULTS,
          RETAIL_PROMOTION_LIST_MAX_RESULTS,
        ),
      ),
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  type ConsensusRow = {
    product_name: string;
    department: string;
    sku: string | null;
    service_area: string;
    fulfilment: string;
    is_alcohol: boolean;
    promotion_type: string;
    loyalty_required: boolean;
    label: string | null;
    description: string | null;
    offer_price_eur: number | string | null;
    regular_price_eur: number | string | null;
    display_price_eur: number | string | null;
    price_per_unit: string | null;
    source_store_count: number | string;
  };

  return ((data ?? []) as ConsensusRow[]).map((row) => {
    const offerPriceEur = numberValue(row.offer_price_eur);
    const regularPriceEur = numberValue(row.regular_price_eur);
    const displayPriceEur = numberValue(row.display_price_eur);
    const stores = numberValue(row.source_store_count) ?? 3;

    return {
      productName: row.product_name,
      department: row.department,
      sku: row.sku,
      currentPriceEur:
        row.promotion_type === "multibuy"
          ? displayPriceEur ?? regularPriceEur
          : offerPriceEur ?? displayPriceEur ?? regularPriceEur,
      wasPriceEur:
        offerPriceEur != null &&
        regularPriceEur != null &&
        regularPriceEur > offerPriceEur
          ? regularPriceEur
          : null,
      discountLabel: row.label ?? row.description,
      isOnOffer: true,
      score: Math.min(1, 0.7 + stores / 100),
      quoteText: formatPromotionQuote({
        productName: row.product_name,
        label: row.label ?? row.description,
        promotionType: row.promotion_type,
        loyaltyRequired: row.loyalty_required === true,
        offerPriceEur,
        regularPriceEur,
        displayPriceEur,
        pricePerUnit: row.price_per_unit,
      }),
      serviceArea: row.service_area,
      fulfilment: row.fulfilment,
      isAlcohol: row.is_alcohol === true,
      source: "synced" as const,
    };
  });
}

export function formatStructuredPromotionNoMatchQuote(query: string): string {
  return [
    `I couldn't confirm a current national SuperValu promotion matching "${query.trim()}" from the promotion data I checked.`,
    "Do not say the promotion does not exist in this store. If the caller needs it confirmed locally, offer a team callback.",
  ].join(" ");
}
