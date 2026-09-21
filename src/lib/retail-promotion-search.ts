import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";

import { retailSearchTokenMatchesText } from "@/lib/retail-search-fuzzy";
import {
  resolveWeeklyOfferSearchFilters,
  tokenizeSupervaluSearchQuery,
} from "@/lib/retail-weekly-offers-search";
import {
  normalizeSearchText,
} from "@/lib/supervalu-offers-normalize";
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
const MAX_PROMOTION_ROWS = 1000;
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

type CatalogProductRow = {
  id: string;
  sku: string;
  product_name: string;
  brand: string | null;
  department: string;
  category_breadcrumb: string | null;
  service_area: string;
  fulfilment: string;
  is_alcohol: boolean;
  is_national: boolean;
  search_text: string;
};

type StoreProductRow = {
  id: string;
  product_id: string;
  source_store_id: string;
  regular_price_eur: number | string | null;
  display_price_eur: number | string | null;
  price_per_unit: string | null;
  retail_catalog_products: CatalogProductRow | CatalogProductRow[] | null;
};

type RetailPromotionRow = {
  id: string;
  promotion_type: string;
  loyalty_required: boolean;
  loyalty_program: string | null;
  offer_price_eur: number | string | null;
  regular_price_eur: number | string | null;
  label: string | null;
  description: string | null;
  valid_from: string;
  valid_to: string;
  national_store_count: number | string | null;
  source_metadata: Record<string, unknown> | null;
  retail_store_products: StoreProductRow | StoreProductRow[] | null;
};

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function numberValue(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNumberWords(value: string): string {
  let out = value.toLowerCase();
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }
  return out
    .replace(/\beuros?\b/gi, "€")
    .replace(/\bpercent\b/gi, "%")
    .replace(/\s+/g, " ")
    .trim();
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

function rowMatchesMechanic(
  row: RetailPromotionRow,
  parsed: ParsedRetailPromotionQuery,
): boolean {
  const label = String(row.label ?? row.description ?? "").trim();
  const normalized = normalizeNumberWords(label);
  if (parsed.loyaltyRequired && row.loyalty_required !== true) return false;

  switch (parsed.mechanic) {
    case "multibuy": {
      if (row.promotion_type !== "multibuy" && !/\d+\s+for\s+/i.test(normalized)) {
        return false;
      }
      if (parsed.quantity == null || parsed.totalEur == null) return true;
      const metaQuantity = numberValue(row.source_metadata?.multibuy_quantity as number | string | null | undefined);
      const metaTotal = numberValue(row.source_metadata?.multibuy_total_eur as number | string | null | undefined);
      if (metaQuantity != null && metaTotal != null) {
        return (
          metaQuantity === parsed.quantity &&
          Math.abs(metaTotal - parsed.totalEur) <= 0.02
        );
      }
      const mechanic = parseLabelMultibuy(label);
      return Boolean(
        mechanic &&
          mechanic.quantity === parsed.quantity &&
          Math.abs(mechanic.totalEur - parsed.totalEur) <= 0.02,
      );
    }
    case "loyalty":
      return row.loyalty_required === true;
    case "half_price":
      return /half\s+price|50\s*%\s*off/i.test(normalized);
    case "save_percent": {
      const meta = numberValue(
        row.source_metadata?.save_percent as number | string | null | undefined,
      );
      const match = normalized.match(
        /(?:save\s+)?(\d+(?:[.,]\d+)?)\s*%\s*(?:off)?/i,
      );
      const value = meta ?? parseMoney(match?.[1]);
      return (
        value != null &&
        (parsed.percent == null || Math.abs(value - parsed.percent) <= 0.01)
      );
    }
    case "save_amount": {
      const meta = numberValue(
        row.source_metadata?.save_amount_eur as number | string | null | undefined,
      );
      const match = normalized.match(
        /save\s+((?:€\s*)?\d+(?:[.,]\d{1,2})?|\d{1,2}\s*c)\b/i,
      );
      const value = meta ?? (match ? parseMoneyExpression(match[1]) : null);
      return (
        value != null &&
        (parsed.amountEur == null ||
          Math.abs(value - parsed.amountEur) <= 0.01)
      );
    }
    case "fixed_price": {
      const match = normalized.match(
        /^only\s+((?:€\s*)?\d+(?:[.,]\d{1,2})?|\d{1,2}\s*c)\b/i,
      );
      const value = match ? parseMoneyExpression(match[1]) : row.offer_price_eur == null ? null : numberValue(row.offer_price_eur);
      return (
        value != null &&
        (parsed.amountEur == null ||
          Math.abs(value - parsed.amountEur) <= 0.01)
      );
    }
    case "named":
      return parsed.namedPhrase
        ? normalizeSearchText(
            `${row.label ?? ""} ${row.description ?? ""}`,
          ).includes(normalizeSearchText(parsed.namedPhrase))
        : false;
    case "generic":
    default:
      return true;
  }
}

function rowSubjectText(
  row: RetailPromotionRow,
  product: CatalogProductRow,
): string {
  return normalizeSearchText(
    [
      product.product_name,
      product.brand,
      product.department,
      product.category_breadcrumb,
      product.search_text,
      row.label,
      row.description,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function rowMatchesSubject(
  row: RetailPromotionRow,
  product: CatalogProductRow,
  subjectTokens: string[],
): boolean {
  if (subjectTokens.length === 0) return true;
  const text = rowSubjectText(row, product);
  return subjectTokens.every((token) => retailSearchTokenMatchesText(text, token));
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
    const individual = input.displayPriceEur ?? input.regularPriceEur;
    if (individual != null) {
      parts.push(`individually ${formatSpokenEurAmount(individual)}`);
    }
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

  const today = formatInTimeZone(new Date(), DUBLIN, "yyyy-MM-dd");
  let query = supabase
    .from("retail_promotions")
    .select(
      `id,promotion_type,loyalty_required,loyalty_program,offer_price_eur,regular_price_eur,label,description,valid_from,valid_to,national_store_count,source_metadata,
       retail_store_products!inner(
         id,product_id,source_store_id,regular_price_eur,display_price_eur,price_per_unit,
         retail_catalog_products!inner(
           id,sku,product_name,brand,department,category_breadcrumb,service_area,fulfilment,is_alcohol,is_national,search_text
         )
       )`,
    )
    .lte("valid_from", today)
    .gte("valid_to", today)
    .eq(
      "retail_store_products.retail_catalog_products.retail_banner",
      input.retailBanner,
    )
    .eq(
      "retail_store_products.retail_catalog_products.is_national",
      true,
    )
    .order("valid_to", { ascending: false })
    .limit(MAX_PROMOTION_ROWS);

  if (parsed.mechanic === "multibuy") {
    query = query.eq("promotion_type", "multibuy");
    if (parsed.quantity != null) {
      query = query.ilike("label", `%${parsed.quantity}%for%`);
    }
  } else if (parsed.mechanic === "loyalty") {
    query = query.eq("loyalty_required", true);
  } else if (parsed.mechanic === "half_price") {
    query = query.ilike("label", "%half%price%");
  } else if (parsed.mechanic === "save_percent" && parsed.percent != null) {
    query = query.ilike("label", `%${parsed.percent}%`);
  } else if (parsed.mechanic === "save_amount" && parsed.amountEur != null) {
    query = query.ilike("label", "%save%");
  } else if (parsed.mechanic === "fixed_price" && parsed.amountEur != null) {
    query = query.ilike("label", "%only%");
  } else if (parsed.mechanic === "named" && parsed.namedPhrase) {
    const phrase = parsed.namedPhrase.replace(/[%(),]/g, " ").trim();
    query = query.or(
      `label.ilike.%${phrase}%,description.ilike.%${phrase}%`,
    );
  }

  if (parsed.loyaltyRequired) {
    query = query.eq("loyalty_required", true);
  }
  if (parsed.serviceArea) {
    query = query.eq(
      "retail_store_products.retail_catalog_products.service_area",
      parsed.serviceArea,
    );
  }
  if (parsed.fulfilment) {
    query = query.eq(
      "retail_store_products.retail_catalog_products.fulfilment",
      parsed.fulfilment,
    );
  }
  for (const token of parsed.subjectTokens.slice(0, 3)) {
    query = query.ilike(
      "retail_store_products.retail_catalog_products.search_text",
      `%${token}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  // Build consensus directly from independent storefront observations.
  // Do not rely on retail_promotions.scope here: multibuy promotions historically
  // failed national-scope promotion because their bundle offer price is null.
  const byPromotion = new Map<
    string,
    {
      row: RetailPromotionRow;
      storeProduct: StoreProductRow;
      product: CatalogProductRow;
      sourceStores: Set<string>;
    }
  >();

  for (const raw of (data ?? []) as unknown as RetailPromotionRow[]) {
    if (!rowMatchesMechanic(raw, parsed)) continue;
    const storeProduct = firstJoin(raw.retail_store_products);
    const product = firstJoin(storeProduct?.retail_catalog_products ?? null);
    if (!storeProduct || !product || product.is_national !== true) continue;
    if (!rowMatchesSubject(raw, product, parsed.subjectTokens)) continue;

    const labelKey = normalizeSearchText(
      `${raw.promotion_type} ${raw.loyalty_required ? "loyalty" : ""} ${raw.label ?? raw.description ?? ""}`,
    );
    const key = `${product.id}|${labelKey}`;
    const existing = byPromotion.get(key);
    if (existing) {
      existing.sourceStores.add(storeProduct.source_store_id);
      continue;
    }
    byPromotion.set(key, {
      row: raw,
      storeProduct,
      product,
      sourceStores: new Set([storeProduct.source_store_id]),
    });
  }

  const limit = Math.max(
    1,
    Math.min(input.limit ?? RETAIL_PROMOTION_LIST_MAX_RESULTS, RETAIL_PROMOTION_LIST_MAX_RESULTS),
  );

  return [...byPromotion.values()]
    .filter((entry) => entry.sourceStores.size >= 3)
    .sort(
      (a, b) =>
        b.sourceStores.size - a.sourceStores.size ||
        a.product.department.localeCompare(b.product.department) ||
        a.product.product_name.localeCompare(b.product.product_name),
    )
    .slice(0, limit)
    .map(({ row, storeProduct, product, sourceStores }) => {
      const offerPriceEur = numberValue(row.offer_price_eur);
      const regularPriceEur =
        numberValue(storeProduct.regular_price_eur) ??
        numberValue(row.regular_price_eur);
      const displayPriceEur = numberValue(storeProduct.display_price_eur);
      return {
        productName: product.product_name,
        department: product.department,
        sku: product.sku,
        currentPriceEur:
          offerPriceEur ?? displayPriceEur ?? regularPriceEur,
        wasPriceEur:
          offerPriceEur != null &&
          regularPriceEur != null &&
          regularPriceEur > offerPriceEur
            ? regularPriceEur
            : null,
        discountLabel: row.label ?? row.description,
        isOnOffer: true,
        score: Math.min(1, 0.7 + sourceStores.size / 100),
        quoteText: formatPromotionQuote({
          productName: product.product_name,
          label: row.label ?? row.description,
          promotionType: row.promotion_type,
          loyaltyRequired: row.loyalty_required === true,
          offerPriceEur,
          regularPriceEur,
          displayPriceEur,
          pricePerUnit: storeProduct.price_per_unit,
        }),
        serviceArea: product.service_area,
        fulfilment: product.fulfilment,
        isAlcohol: product.is_alcohol === true,
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
