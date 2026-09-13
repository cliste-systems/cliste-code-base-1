import {
  SUPERVALU_MEAT_CATEGORY_SEEDS,
  SUPERVALU_STOREFRONT_STORE_ID,
} from "@/lib/supervalu-offers-types";
import {
  fetchSupervaluGatewayJson,
  fetchSupervaluGatewaySearch,
  SUPERVALU_GATEWAY_BASE,
  SUPERVALU_GATEWAY_PAGE_SIZE,
} from "@/lib/supervalu-gateway";
import {
  normalizeSupervaluGatewayProduct,
  type NormalizedWeeklyOffer,
} from "@/lib/supervalu-offers-normalize";

const MEAT_SEARCH_QUERIES = [
  "striploin",
  "sirloin",
  "rib eye",
  "rump steak",
  "lamb chop",
  "pork steak",
];

export async function fetchSupervaluCategoryOffers(input: {
  categoryId: string;
  department: string;
  storeId?: string;
}): Promise<NormalizedWeeklyOffer[]> {
  const storeId = input.storeId ?? SUPERVALU_STOREFRONT_STORE_ID;
  const offers: NormalizedWeeklyOffer[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;

  while (skip < total) {
    const url =
      `${SUPERVALU_GATEWAY_BASE}/stores/${encodeURIComponent(storeId)}` +
      `/categories/${encodeURIComponent(input.categoryId)}/search` +
      `?take=${SUPERVALU_GATEWAY_PAGE_SIZE}&skip=${skip}`;
    const payload = await fetchSupervaluGatewayJson(url);
    total = Number(payload.total ?? payload.count ?? 0);
    const items = payload.items ?? [];

    for (const item of items) {
      const normalized = normalizeSupervaluGatewayProduct(item, input.department);
      if (normalized) offers.push(normalized);
    }

    if (items.length < SUPERVALU_GATEWAY_PAGE_SIZE) break;
    skip += SUPERVALU_GATEWAY_PAGE_SIZE;
  }

  return offers;
}

export async function fetchSupervaluSearchOffers(input: {
  query: string;
  department?: string;
  storeId?: string;
}): Promise<NormalizedWeeklyOffer[]> {
  const department = input.department ?? "Butcher";
  const items = await fetchSupervaluGatewaySearch({
    query: input.query,
    storeId: input.storeId,
  });
  const offers: NormalizedWeeklyOffer[] = [];
  for (const item of items) {
    const normalized = normalizeSupervaluGatewayProduct(item, department);
    if (!normalized) continue;
    const altCategory = String(item.attributes?.altCategory ?? "").trim().toLowerCase();
    if (
      altCategory &&
      !/butcher|beef|lamb|pork|poultry|meat|steak|chicken/i.test(altCategory)
    ) {
      continue;
    }
    offers.push(normalized);
  }
  return offers;
}

export async function fetchSupervaluMeatPilotOffers(
  storeId = SUPERVALU_STOREFRONT_STORE_ID,
): Promise<NormalizedWeeklyOffer[]> {
  const bySku = new Map<string, NormalizedWeeklyOffer>();

  for (const seed of SUPERVALU_MEAT_CATEGORY_SEEDS) {
    const categoryOffers = await fetchSupervaluCategoryOffers({
      categoryId: seed.categoryId,
      department: seed.department,
      storeId,
    });
    for (const offer of categoryOffers) {
      const key = offer.sku ?? `${offer.productName}:${offer.currentPriceEur}`;
      if (!bySku.has(key)) bySku.set(key, offer);
    }
  }

  for (const query of MEAT_SEARCH_QUERIES) {
    const searchOffers = await fetchSupervaluSearchOffers({ query, storeId });
    for (const offer of searchOffers) {
      const key = offer.sku ?? `${offer.productName}:${offer.currentPriceEur}`;
      if (!bySku.has(key)) bySku.set(key, offer);
    }
  }

  return [...bySku.values()].sort((a, b) =>
    a.productName.localeCompare(b.productName),
  );
}

export type { NormalizedWeeklyOffer };
