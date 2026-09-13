import {
  discoverSupervaluPromoCategories,
  SUPERVALU_PROMO_CATEGORY_SEEDS,
  SUPERVALU_PROMO_SEARCH_SUPPLEMENTS,
  type SupervaluPromoCategorySeed,
} from "@/lib/supervalu-promo-category-map";
import { SUPERVALU_STOREFRONT_STORE_ID } from "@/lib/supervalu-offers-types";
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
import type { SupervaluGatewayProduct } from "@/lib/supervalu-offers-types";

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

export async function fetchSupervaluCategoryPromotions(input: {
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
      `?take=${SUPERVALU_GATEWAY_PAGE_SIZE}&skip=${skip}&sort=ppfreq&fpromotions=True`;
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

/** @deprecated Use fetchSupervaluCategoryPromotions */
export async function fetchSupervaluCategoryOffers(input: {
  categoryId: string;
  department: string;
  storeId?: string;
}): Promise<NormalizedWeeklyOffer[]> {
  return fetchSupervaluCategoryPromotions(input);
}

function isAlcoholProduct(product: SupervaluGatewayProduct): boolean {
  return product.attributes?.["Alcohol Restricted"] === true;
}

export async function fetchSupervaluSearchPromotions(input: {
  query: string;
  department?: string;
  storeId?: string;
  promotionsOnly?: boolean;
  alcoholOnly?: boolean;
  meatOnly?: boolean;
}): Promise<NormalizedWeeklyOffer[]> {
  const department = input.department ?? "Grocery";
  const storeId = input.storeId ?? SUPERVALU_STOREFRONT_STORE_ID;
  const offers: NormalizedWeeklyOffer[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;

  while (skip < total) {
    const promoPart = input.promotionsOnly ? "&sort=ppfreq&fpromotions=True" : "";
    const url =
      `${SUPERVALU_GATEWAY_BASE}/stores/${encodeURIComponent(storeId)}/search` +
      `?q=${encodeURIComponent(input.query)}&take=${SUPERVALU_GATEWAY_PAGE_SIZE}&skip=${skip}${promoPart}`;
    const payload = await fetchSupervaluGatewayJson(url);
    total = Number(payload.total ?? payload.count ?? 0);
    const items = payload.items ?? [];

    for (const item of items) {
      if (input.alcoholOnly && !isAlcoholProduct(item)) continue;
      if (input.alcoholOnly === false && isAlcoholProduct(item)) continue;
      const normalized = normalizeSupervaluGatewayProduct(item, department);
      if (!normalized) continue;
      if (input.meatOnly) {
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
  return fetchSupervaluSearchPromotions({
    ...input,
    promotionsOnly: false,
  });
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

async function resolvePromoSyncCategories(
  storeId: string,
): Promise<SupervaluPromoCategorySeed[]> {
  const discovery = await discoverSupervaluPromoCategories({
    storeId,
    harvestSubcategories: true,
    maxCategories: 120,
  });
  const byId = new Map<string, SupervaluPromoCategorySeed>();
  for (const seed of SUPERVALU_PROMO_CATEGORY_SEEDS) {
    byId.set(seed.categoryId, seed);
  }
  for (const cat of discovery.categories) {
    byId.set(cat.categoryId, {
      categoryId: cat.categoryId,
      department: cat.categoryName ?? cat.department,
    });
  }
  for (const sub of discovery.harvestedSubcategories) {
    if (!byId.has(sub.categoryId)) byId.set(sub.categoryId, sub);
  }
  return [...byId.values()];
}

export async function fetchSupervaluMeatPilotOffers(
  storeId = SUPERVALU_STOREFRONT_STORE_ID,
): Promise<NormalizedWeeklyOffer[]> {
  const bySku = new Map<string, NormalizedWeeklyOffer>();

  for (const query of MEAT_SEARCH_QUERIES) {
    mergeOffers(
      bySku,
      await fetchSupervaluSearchPromotions({ query, storeId, meatOnly: true, promotionsOnly: true }),
    );
  }

  return [...bySku.values()].sort((a, b) =>
    a.productName.localeCompare(b.productName),
  );
}

/** Full-store promotional snapshot — exhaustive fpromotions crawl for Cara. */
export async function fetchSupervaluFullStoreOffers(
  storeId = SUPERVALU_STOREFRONT_STORE_ID,
): Promise<NormalizedWeeklyOffer[]> {
  const bySku = new Map<string, NormalizedWeeklyOffer>();
  const categories = await resolvePromoSyncCategories(storeId);

  for (const seed of categories) {
    mergeOffers(
      bySku,
      await fetchSupervaluCategoryPromotions({
        categoryId: seed.categoryId,
        department: seed.department,
        storeId,
      }),
    );
  }

  for (const supplement of SUPERVALU_PROMO_SEARCH_SUPPLEMENTS) {
    mergeOffers(
      bySku,
      await fetchSupervaluSearchPromotions({
        query: supplement.query,
        department: supplement.department,
        storeId,
        promotionsOnly: supplement.promotionsOnly ?? true,
        alcoholOnly: supplement.alcoholOnly,
        meatOnly: /butcher|striploin|rashers|ham/i.test(supplement.query),
      }),
    );
  }

  return [...bySku.values()].sort(
    (a, b) =>
      a.serviceArea.localeCompare(b.serviceArea) ||
      a.productName.localeCompare(b.productName),
  );
}

export function countOffersByServiceArea(
  offers: NormalizedWeeklyOffer[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const offer of offers) {
    const key = `${offer.serviceArea}:${offer.fulfilment}`;
    counts[key] = (counts[key] ?? 0) + 1;
    counts[offer.serviceArea] = (counts[offer.serviceArea] ?? 0) + 1;
  }
  return counts;
}

export type { NormalizedWeeklyOffer };
