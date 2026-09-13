import {
  SUPERVALU_FULL_STORE_CATEGORY_SEEDS,
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
  "rashers",
  "sausages",
  "ham",
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
  meatOnly?: boolean;
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
    if (input.meatOnly !== false) {
      const altCategory = String(item.attributes?.altCategory ?? "").trim().toLowerCase();
      if (
        altCategory &&
        !/butcher|beef|lamb|pork|poultry|meat|steak|chicken|rashers|sausage|pudding|ham|deli/i.test(
          altCategory,
        )
      ) {
        continue;
      }
    }
    offers.push(normalized);
  }
  return offers;
}

function mergeOffers(
  bySku: Map<string, NormalizedWeeklyOffer>,
  offers: NormalizedWeeklyOffer[],
): void {
  for (const offer of offers) {
    const key = offer.sku ?? `${offer.productName}:${offer.currentPriceEur}`;
    if (!bySku.has(key)) bySku.set(key, offer);
  }
}

/** Legacy meat-only pilot fetch (kept for tests and fallback). */
export async function fetchSupervaluMeatPilotOffers(
  storeId = SUPERVALU_STOREFRONT_STORE_ID,
): Promise<NormalizedWeeklyOffer[]> {
  const bySku = new Map<string, NormalizedWeeklyOffer>();

  for (const seed of SUPERVALU_MEAT_CATEGORY_SEEDS) {
    mergeOffers(
      bySku,
      await fetchSupervaluCategoryOffers({
        categoryId: seed.categoryId,
        department: seed.department,
        storeId,
      }),
    );
  }

  for (const query of MEAT_SEARCH_QUERIES) {
    mergeOffers(
      bySku,
      await fetchSupervaluSearchOffers({ query, storeId, meatOnly: true }),
    );
  }

  return [...bySku.values()].sort((a, b) =>
    a.productName.localeCompare(b.productName),
  );
}

/** Full-store promotional snapshot — all synced weekly offers for Cara. */
export async function fetchSupervaluFullStoreOffers(
  storeId = SUPERVALU_STOREFRONT_STORE_ID,
): Promise<NormalizedWeeklyOffer[]> {
  const bySku = new Map<string, NormalizedWeeklyOffer>();
  const categorySeeds = [
    ...SUPERVALU_FULL_STORE_CATEGORY_SEEDS,
    ...SUPERVALU_MEAT_CATEGORY_SEEDS,
  ];

  for (const seed of categorySeeds) {
    mergeOffers(
      bySku,
      await fetchSupervaluCategoryOffers({
        categoryId: seed.categoryId,
        department: seed.department,
        storeId,
      }),
    );
  }

  for (const query of MEAT_SEARCH_QUERIES) {
    mergeOffers(
      bySku,
      await fetchSupervaluSearchOffers({ query, storeId, meatOnly: true }),
    );
  }

  return [...bySku.values()].sort((a, b) =>
    a.productName.localeCompare(b.productName) ||
    a.department.localeCompare(b.department),
  );
}

export type { NormalizedWeeklyOffer };
