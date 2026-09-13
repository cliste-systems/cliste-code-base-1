import { fetchSupervaluGatewaySearch } from "@/lib/supervalu-gateway";
import { normalizeSearchText } from "@/lib/supervalu-offers-normalize";
import type { SupervaluGatewayProduct } from "@/lib/supervalu-offers-types";
import {
  tokenizeSupervaluSearchQuery,
  scoreSupervaluSearchText,
} from "@/lib/retail-weekly-offers-search";

export const SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS = 120;
export const SUPERVALU_CATALOG_SEARCH_MAX_RESULTS = 5;

export type SupervaluCatalogProduct = {
  productName: string;
  department: string;
  sku: string | null;
  sourceUrl: string | null;
  searchText: string;
};

export type SupervaluCatalogMatch = {
  productName: string;
  department: string;
  sku: string | null;
  score: number;
  quoteText: string;
};

export function normalizeSupervaluCatalogProduct(
  product: SupervaluGatewayProduct,
): SupervaluCatalogProduct | null {
  const productName = String(product.name ?? "").trim();
  if (!productName) return null;

  const sku = String(product.sku ?? product.productId ?? "").trim() || null;
  const department =
    String(product.attributes?.altCategory ?? "").trim() || "Grocery";

  return {
    productName,
    department,
    sku,
    sourceUrl: String(product.url ?? "").trim() || null,
    searchText: normalizeSearchText(
      [productName, department, sku ?? ""].filter(Boolean).join(" "),
    ),
  };
}

export function formatCatalogStockQuote(input: {
  productName: string;
  department?: string | null;
}): string {
  const dept =
    input.department && input.department !== "Grocery"
      ? ` (${input.department})`
      : "";
  return [
    `As far as I'm aware, yes — we carry ${input.productName}${dept} as part of the SuperValu range.`,
    "I can't confirm it's on the shelf at this exact moment.",
    "I can ask a team member to call you back to confirm availability — would that suit you?",
  ].join(" ");
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

  const items = await fetchSupervaluGatewaySearch({
    query: trimmed,
    storeId: options?.storeId,
  });

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
    score,
    quoteText: formatCatalogStockQuote({
      productName: product.productName,
      department: product.department,
    }),
  }));
}
