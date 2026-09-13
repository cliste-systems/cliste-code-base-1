import { fetchSupervaluGatewaySearch } from "@/lib/supervalu-gateway";
import { normalizeSearchText } from "@/lib/supervalu-offers-normalize";
import type { SupervaluGatewayProduct } from "@/lib/supervalu-offers-types";
import {
  tokenizeSupervaluSearchQuery,
  scoreSupervaluSearchText,
} from "@/lib/retail-weekly-offers-search";

export const SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS = 120;
export const SUPERVALU_CATALOG_SEARCH_MAX_RESULTS = 5;

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
};

export type SupervaluCatalogMatch = {
  productName: string;
  department: string;
  sku: string | null;
  currentPriceEur: number | null;
  wasPriceEur: number | null;
  discountLabel: string | null;
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
  };
}

export function formatCatalogStockQuote(input: {
  productName: string;
  department?: string | null;
  currentPriceEur?: number | null;
  wasPriceEur?: number | null;
  discountLabel?: string | null;
  pricePerUnit?: string | null;
}): string {
  const dept =
    input.department && input.department !== "Grocery"
      ? ` (${input.department})`
      : "";
  const parts: string[] = [];

  if (input.currentPriceEur != null) {
    const price = `€${input.currentPriceEur.toFixed(2)}`;
    if (input.wasPriceEur != null && input.wasPriceEur > input.currentPriceEur) {
      parts.push(
        `${input.productName}${dept} is on offer at ${price} (was €${input.wasPriceEur.toFixed(2)}) on the SuperValu national range.`,
      );
      if (input.discountLabel) {
        parts[parts.length - 1] += ` — ${input.discountLabel}`;
      }
    } else {
      parts.push(
        `${input.productName}${dept} is listed at ${price} on the SuperValu national range.`,
      );
    }
    if (input.pricePerUnit) {
      parts.push(`Unit price: ${input.pricePerUnit}.`);
    }
  } else {
    parts.push(
      `As far as I'm aware, yes — we carry ${input.productName}${dept} as part of the SuperValu range.`,
    );
  }

  parts.push(
    "I can't confirm today's shelf price or that it's in stock at this exact moment.",
  );
  parts.push(
    "I can ask a team member to call you back to confirm availability — would that suit you?",
  );

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
  options?: { storeId?: string },
): Promise<SupervaluCatalogMatch[]> {
  const trimmed = query.trim().slice(0, SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS);
  if (!trimmed) return [];

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
    )
    .slice(0, SUPERVALU_CATALOG_SEARCH_MAX_RESULTS);

  return scored.map(({ product, score }) => ({
    productName: product.productName,
    department: product.department,
    sku: product.sku,
    currentPriceEur: product.currentPriceEur,
    wasPriceEur: product.wasPriceEur,
    discountLabel: product.discountLabel,
    score,
    quoteText: formatCatalogStockQuote({
      productName: product.productName,
      department: product.department,
      currentPriceEur: product.currentPriceEur,
      wasPriceEur: product.wasPriceEur,
      discountLabel: product.discountLabel,
      pricePerUnit: product.pricePerUnit,
    }),
  }));
}
