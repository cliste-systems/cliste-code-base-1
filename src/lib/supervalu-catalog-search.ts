import { fetchSupervaluGatewaySearch } from "@/lib/supervalu-gateway";
import {
  isPromotionalSupervaluProduct,
  normalizeSearchText,
} from "@/lib/supervalu-offers-normalize";
import type { SupervaluGatewayProduct } from "@/lib/supervalu-offers-types";
import {
  tokenizeSupervaluSearchQuery,
  scoreSupervaluSearchText,
} from "@/lib/retail-weekly-offers-search";
import {
  formatSpokenDiscountLabel,
  formatSpokenEurAmount,
  speakEmbeddedEurAmounts,
} from "@/lib/spoken-eur-price";

export const SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS = 120;
export const SUPERVALU_CATALOG_SEARCH_MAX_RESULTS = 5;

export type CatalogQuoteIntent = "offer" | "price" | "stock";

/** Infer whether the caller wants offer status, a price, or stock/range info. */
export function inferCatalogSearchIntent(query: string): CatalogQuoteIntent {
  const q = query.toLowerCase();
  if (
    /\bon offer\b|\bthis week\b|\bspecial\b|\bpromo|\bpromotion|\bdeal\b|\breduced\b|\bany offers\b|\bis it on\b|\bare they on\b|\boffers?\s+this\b/i.test(
      q,
    )
  ) {
    return "offer";
  }
  if (
    /\bhow much\b|\bprice\b|\bcost\b|\bwhat'?s the price\b|\bhow much is\b|\bwhat is the price\b/i.test(
      q,
    )
  ) {
    return "price";
  }
  return "stock";
}

/** Expand caller phrasing into gateway queries that actually return results. */
export function expandSupervaluCatalogSearchQueries(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queries = new Set<string>([trimmed]);

  if (/sriracha/i.test(trimmed)) {
    queries.add(trimmed.replace(/sriracha/gi, "chilli"));
    if (/hellmann/i.test(trimmed)) {
      queries.add("Hellmann's chilli");
    }
  }

  const tokens = tokenizeSupervaluSearchQuery(trimmed);
  if (tokens.length >= 2 && tokens[0]) {
    queries.add(tokens.slice(0, 2).join(" "));
  }

  return [...queries];
}

export type SupervaluCatalogProduct = {
  productName: string;
  department: string;
  sku: string | null;
  sourceUrl: string | null;
  searchText: string;
  currentPriceEur: number | null;
  wasPriceEur: number | null;
  discountLabel: string | null;
  pricePerUnit: string | null;
  isOnOffer: boolean;
};

export type SupervaluCatalogMatch = {
  productName: string;
  department: string;
  sku: string | null;
  currentPriceEur: number | null;
  wasPriceEur: number | null;
  discountLabel: string | null;
  isOnOffer: boolean;
  score: number;
  quoteText: string;
};

function parseGatewayPriceEur(product: SupervaluGatewayProduct): number | null {
  const current = Number(product.priceNumeric ?? product.wholePrice ?? 0);
  if (Number.isFinite(current) && current > 0) return current;
  const fromLabel = String(product.price ?? "")
    .replace(/[^\d.,]/g, "")
    .replace(",", ".");
  const parsed = Number(fromLabel);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeSupervaluCatalogProduct(
  product: SupervaluGatewayProduct,
): SupervaluCatalogProduct | null {
  const productName = String(product.name ?? "").trim();
  if (!productName) return null;

  const sku = String(product.sku ?? product.productId ?? "").trim() || null;
  const department =
    String(product.attributes?.altCategory ?? "").trim() || "Grocery";
  const currentPriceEur = parseGatewayPriceEur(product);
  const wasRaw = Number(product.wasPriceNumeric ?? 0);
  const wasPriceEur =
    currentPriceEur != null &&
    Number.isFinite(wasRaw) &&
    wasRaw > currentPriceEur
      ? wasRaw
      : null;

  return {
    productName,
    department,
    sku,
    sourceUrl: String(product.url ?? "").trim() || null,
    searchText: normalizeSearchText(
      [productName, department, sku ?? ""].filter(Boolean).join(" "),
    ),
    currentPriceEur,
    wasPriceEur,
    discountLabel: String(product.priceLabel ?? "").trim() || null,
    pricePerUnit: String(product.pricePerUnit ?? "").trim() || null,
    isOnOffer: isPromotionalSupervaluProduct(product),
  };
}

function catalogProductToMatch(
  product: SupervaluCatalogProduct,
  score: number,
  intent: CatalogQuoteIntent,
): SupervaluCatalogMatch {
  return {
    productName: product.productName,
    department: product.department,
    sku: product.sku,
    currentPriceEur: product.currentPriceEur,
    wasPriceEur: product.wasPriceEur,
    discountLabel: product.discountLabel,
    isOnOffer: product.isOnOffer,
    score,
    quoteText: formatCatalogStockQuote({
      productName: product.productName,
      department: product.department,
      currentPriceEur: product.currentPriceEur,
      wasPriceEur: product.wasPriceEur,
      discountLabel: product.discountLabel,
      pricePerUnit: product.pricePerUnit,
      isOnOffer: product.isOnOffer,
      intent,
    }),
  };
}

export function formatCatalogStockQuote(input: {
  productName: string;
  department?: string | null;
  currentPriceEur?: number | null;
  wasPriceEur?: number | null;
  discountLabel?: string | null;
  pricePerUnit?: string | null;
  isOnOffer?: boolean;
  intent?: CatalogQuoteIntent;
}): string {
  const dept =
    input.department && input.department !== "Grocery"
      ? ` (${input.department})`
      : "";
  const intent = input.intent ?? "stock";
  const onOffer =
    input.isOnOffer ??
    ((input.wasPriceEur != null &&
      input.currentPriceEur != null &&
      input.wasPriceEur > input.currentPriceEur) ||
      Boolean(input.discountLabel?.trim()));
  const parts: string[] = [];

  if (intent === "offer") {
    if (onOffer && input.currentPriceEur != null) {
      const price = formatSpokenEurAmount(input.currentPriceEur);
      const wasPrice =
        input.wasPriceEur != null
          ? formatSpokenEurAmount(input.wasPriceEur)
          : null;
      parts.push(
        wasPrice
          ? `${input.productName}${dept} is on offer this week at ${price} — was ${wasPrice} — on the SuperValu national range.`
          : `${input.productName}${dept} is on offer this week at ${price} on the SuperValu national range.`,
      );
      const spokenLabel = formatSpokenDiscountLabel(input.discountLabel);
      if (spokenLabel) {
        parts[parts.length - 1] += ` Offer label: ${spokenLabel}.`;
      }
    } else {
      parts.push(
        `${input.productName}${dept} is not showing as on offer this week on the national range I checked.`,
      );
    }
    parts.push(
      "I can't confirm in-store shelf promos — a team member can double-check if you'd like.",
    );
    return parts.join(" ");
  }

  if (input.currentPriceEur != null) {
    const price = formatSpokenEurAmount(input.currentPriceEur);
    if (onOffer) {
      const wasPrice =
        input.wasPriceEur != null
          ? formatSpokenEurAmount(input.wasPriceEur)
          : null;
      parts.push(
        wasPrice
          ? `${input.productName}${dept} is on offer at ${price} — was ${wasPrice} — on the SuperValu national range.`
          : `${input.productName}${dept} is on offer at ${price} on the SuperValu national range.`,
      );
      const spokenLabel = formatSpokenDiscountLabel(input.discountLabel);
      if (spokenLabel) {
        parts[parts.length - 1] += ` Offer label: ${spokenLabel}.`;
      }
    } else if (intent === "price") {
      parts.push(
        `${input.productName}${dept} is ${price} — that's the regular price; it's not on offer this week on the range I checked.`,
      );
    } else {
      parts.push(
        `${input.productName}${dept} is listed at ${price} on the SuperValu national range — not on offer this week.`,
      );
    }
    if (input.pricePerUnit) {
      parts.push(`Unit price: ${speakEmbeddedEurAmounts(input.pricePerUnit)}.`);
    }
  } else {
    parts.push(
      `As far as I'm aware, yes — we carry ${input.productName}${dept} as part of the SuperValu range.`,
    );
  }

  parts.push(
    "I can't confirm today's shelf price or that it's in stock at this exact moment.",
  );
  if (intent !== "price") {
    parts.push(
      "I can ask a team member to call you back to confirm availability — would that suit you?",
    );
  }

  return parts.join(" ");
}

export function formatCatalogStockNoMatchQuote(query: string): string {
  return [
    `I couldn't find "${query.trim()}" on the SuperValu product range I checked — I don't want to guess.`,
    "I can ask someone on the shop floor to call you back if you'd like, or you can check when you're in.",
  ].join(" ");
}

export async function searchSupervaluCatalogLive(
  query: string,
  options?: { storeId?: string; intent?: CatalogQuoteIntent },
): Promise<SupervaluCatalogMatch[]> {
  const trimmed = query.trim().slice(0, SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS);
  if (!trimmed) return [];

  const intent = options?.intent ?? inferCatalogSearchIntent(trimmed);
  const tokens = tokenizeSupervaluSearchQuery(trimmed);
  if (tokens.length === 0) return [];

  let items: Awaited<ReturnType<typeof fetchSupervaluGatewaySearch>> = [];
  for (const candidate of expandSupervaluCatalogSearchQueries(trimmed)) {
    items = await fetchSupervaluGatewaySearch({
      query: candidate,
      storeId: options?.storeId,
    });
    if (items.length > 0) break;
  }

  const scored = items
    .map((item) => {
      const product = normalizeSupervaluCatalogProduct(item);
      if (!product) return null;
      return {
        product,
        score: scoreSupervaluSearchText(product.searchText, tokens, product.department),
      };
    })
    .filter(
      (entry): entry is { product: SupervaluCatalogProduct; score: number } =>
        entry != null && entry.score >= 0.5,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.productName.localeCompare(b.product.productName),
    );

  if (scored.length === 0) return [];

  if (intent === "offer") {
    const promoMatches = scored.filter(({ product }) => product.isOnOffer);
    if (promoMatches.length === 0) {
      const best = scored[0]!;
      return [catalogProductToMatch(best.product, best.score, intent)];
    }
    return promoMatches
      .slice(0, SUPERVALU_CATALOG_SEARCH_MAX_RESULTS)
      .map(({ product, score }) => catalogProductToMatch(product, score, intent));
  }

  return scored
    .slice(0, SUPERVALU_CATALOG_SEARCH_MAX_RESULTS)
    .map(({ product, score }) => catalogProductToMatch(product, score, intent));
}
