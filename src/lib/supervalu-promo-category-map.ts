import {
  fetchSupervaluGatewayJson,
  SUPERVALU_GATEWAY_BASE,
  SUPERVALU_GATEWAY_PAGE_SIZE,
} from "@/lib/supervalu-gateway";
import {
  SUPERVALU_STOREFRONT_STORE_ID,
  type SupervaluGatewayProduct,
} from "@/lib/supervalu-offers-types";

export type SupervaluPromoCategorySeed = {
  categoryId: string;
  department: string;
  /** Optional breadcrumb hint for classification */
  breadcrumbHint?: string;
};

/** Top-level + high-yield category IDs (labels corrected from gateway). */
export const SUPERVALU_PROMO_CATEGORY_SEEDS: SupervaluPromoCategorySeed[] = [
  { categoryId: "O100010", department: "Bakery", breadcrumbHint: "Grocery/Bakery" },
  { categoryId: "O100015", department: "Meat & Poultry", breadcrumbHint: "Grocery/Meat & Poultry" },
  { categoryId: "O100020", department: "Deli Counter", breadcrumbHint: "Grocery/Deli Counter" },
  { categoryId: "O100025", department: "Fresh Fruit & Veg", breadcrumbHint: "Grocery/Fresh Fruit & Veg" },
  { categoryId: "O100030", department: "Chilled Food", breadcrumbHint: "Grocery/Chilled Food" },
  { categoryId: "O100035", department: "Food Cupboard", breadcrumbHint: "Grocery/Food Cupboard" },
  { categoryId: "O100040", department: "Drinks", breadcrumbHint: "Grocery/Drinks" },
  { categoryId: "O100045", department: "Frozen Foods", breadcrumbHint: "Grocery/Frozen Foods" },
  { categoryId: "O100017", department: "Fish & Seafood", breadcrumbHint: "Grocery/Fish & Seafood" },
  { categoryId: "O200105", department: "Fish Counter", breadcrumbHint: "Grocery/Fish & Seafood/Fish Counter" },
  { categoryId: "O200115", department: "Prepack Fresh Fish", breadcrumbHint: "Grocery/Fish & Seafood/Prepack Fresh Fish" },
  { categoryId: "O200350", department: "Frozen Fish & Seafood", breadcrumbHint: "Grocery/Frozen Foods/Frozen Fish & Seafood" },
  { categoryId: "O100050", department: "Household", breadcrumbHint: "Grocery/Household" },
  { categoryId: "O100055", department: "Health & Beauty", breadcrumbHint: "Grocery/Health & Beauty" },
  { categoryId: "O200325", department: "Chocolate & Sweets", breadcrumbHint: "Grocery/Chocolate & Sweets" },
  { categoryId: "O200055", department: "Fresh In Store Bakery", breadcrumbHint: "Grocery/Bakery/Fresh In Store Bakery" },
  { categoryId: "O200150", department: "Cooked Meats", breadcrumbHint: "Grocery/Deli Counter/Cooked Meats" },
  { categoryId: "O200088", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O200213", department: "Sliced Cooked Meats", breadcrumbHint: "Grocery/Chilled Food/Sliced Cooked Meats" },
  { categoryId: "O411190", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O411290", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O411195", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O411215", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O303440", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O300470", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O303395", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O411335", department: "Butcher", breadcrumbHint: "Grocery/Butcher" },
  { categoryId: "O300545", department: "Deli", breadcrumbHint: "Grocery/Deli" },
  { categoryId: "O300565", department: "Ham", breadcrumbHint: "Grocery/Deli Counter/Cooked Meats/Ham" },
  { categoryId: "O303025", department: "Ham", breadcrumbHint: "Grocery/Chilled Food/Sliced Cooked Meats/Ham" },
  { categoryId: "O200340", department: "Wine", breadcrumbHint: "Grocery/Drinks/Wine" },
  { categoryId: "O200330", department: "Beer & Cider", breadcrumbHint: "Grocery/Drinks/Beer" },
  { categoryId: "O200335", department: "Spirits", breadcrumbHint: "Grocery/Drinks/Spirits" },
];

/** Full map used by sync — seeds plus harvested subcategories. */
export const SUPERVALU_PROMO_CATEGORY_MAP: SupervaluPromoCategorySeed[] = [
  ...SUPERVALU_PROMO_CATEGORY_SEEDS,
];

export type SupervaluCategoryPromoCount = {
  categoryId: string;
  department: string;
  promoTotal: number;
  categoryName?: string;
};

export type SupervaluPromoDiscoveryResult = {
  categories: SupervaluCategoryPromoCount[];
  harvestedSubcategories: SupervaluPromoCategorySeed[];
  totalPromoSkusEstimate: number;
};

type GatewayCategoryEntry = {
  retailerId?: string;
  category?: string;
  categoryBreadcrumb?: string;
};

function extractSubcategoriesFromProduct(
  product: SupervaluGatewayProduct,
): SupervaluPromoCategorySeed[] {
  const categories = (product as SupervaluGatewayProduct & {
    categories?: GatewayCategoryEntry[];
    defaultCategory?: GatewayCategoryEntry[];
  }).categories;
  const all = [...(categories ?? []), ...((product as { defaultCategory?: GatewayCategoryEntry[] }).defaultCategory ?? [])];
  const out: SupervaluPromoCategorySeed[] = [];
  for (const cat of all) {
    const categoryId = String(cat.retailerId ?? "").trim();
    if (!categoryId || categoryId === "Grocery" || !/^O/i.test(categoryId)) continue;
    const breadcrumb = String(cat.categoryBreadcrumb ?? cat.category ?? "").trim();
    const department = String(cat.category ?? breadcrumb.split("/").pop() ?? "Grocery").trim();
    out.push({ categoryId, department, breadcrumbHint: breadcrumb || undefined });
  }
  return out;
}

export async function countSupervaluCategoryPromotions(input: {
  categoryId: string;
  storeId?: string;
}): Promise<{ total: number; categoryName?: string }> {
  const storeId = input.storeId ?? SUPERVALU_STOREFRONT_STORE_ID;
  const url =
    `${SUPERVALU_GATEWAY_BASE}/stores/${encodeURIComponent(storeId)}` +
    `/categories/${encodeURIComponent(input.categoryId)}/search` +
    `?take=1&sort=ppfreq&fpromotions=True`;
  const payload = await fetchSupervaluGatewayJson(url);
  return {
    total: Number(payload.total ?? payload.count ?? 0),
    categoryName: (payload as { categoryName?: string }).categoryName,
  };
}

export async function discoverSupervaluPromoCategories(options?: {
  storeId?: string;
  harvestSubcategories?: boolean;
  maxCategories?: number;
}): Promise<SupervaluPromoDiscoveryResult> {
  const storeId = options?.storeId ?? SUPERVALU_STOREFRONT_STORE_ID;
  const maxCategories = options?.maxCategories ?? 120;
  const seen = new Map<string, SupervaluPromoCategorySeed>();
  for (const seed of SUPERVALU_PROMO_CATEGORY_SEEDS) {
    seen.set(seed.categoryId, seed);
  }

  const harvested: SupervaluPromoCategorySeed[] = [];
  if (options?.harvestSubcategories !== false) {
    for (const seed of SUPERVALU_PROMO_CATEGORY_SEEDS.slice(0, 12)) {
      const url =
        `${SUPERVALU_GATEWAY_BASE}/stores/${encodeURIComponent(storeId)}` +
        `/categories/${encodeURIComponent(seed.categoryId)}/search` +
        `?take=${Math.min(SUPERVALU_GATEWAY_PAGE_SIZE, 25)}&sort=ppfreq&fpromotions=True`;
      const payload = await fetchSupervaluGatewayJson(url);
      for (const item of payload.items ?? []) {
        for (const sub of extractSubcategoriesFromProduct(item)) {
          if (seen.has(sub.categoryId)) continue;
          seen.set(sub.categoryId, sub);
          harvested.push(sub);
          if (seen.size >= maxCategories) break;
        }
        if (seen.size >= maxCategories) break;
      }
      if (seen.size >= maxCategories) break;
    }
  }

  const categories: SupervaluCategoryPromoCount[] = [];
  let totalPromoSkusEstimate = 0;
  for (const seed of seen.values()) {
    try {
      const { total, categoryName } = await countSupervaluCategoryPromotions({
        categoryId: seed.categoryId,
        storeId,
      });
      if (total <= 0) continue;
      categories.push({
        categoryId: seed.categoryId,
        department: seed.department,
        promoTotal: total,
        categoryName,
      });
      totalPromoSkusEstimate += total;
    } catch {
      /* skip unreachable categories */
    }
  }

  categories.sort((a, b) => b.promoTotal - a.promoTotal);
  return {
    categories,
    harvestedSubcategories: harvested,
    totalPromoSkusEstimate,
  };
}

/** Categories with at least one promo — used by full-store sync. */
export function getSupervaluPromoSyncCategories(): SupervaluPromoCategorySeed[] {
  return SUPERVALU_PROMO_CATEGORY_MAP;
}

export const SUPERVALU_PROMO_SEARCH_SUPPLEMENTS: {
  query: string;
  department: string;
  promotionsOnly?: boolean;
  alcoholOnly?: boolean;
}[] = [
  { query: "carrolls ham", department: "Ham", promotionsOnly: true },
  { query: "cooked ham", department: "Ham", promotionsOnly: true },
  { query: "salami", department: "Deli", promotionsOnly: true },
  { query: "chicken fillets", department: "Deli", promotionsOnly: true },
  { query: "striploin", department: "Butcher", promotionsOnly: true },
  { query: "sirloin", department: "Butcher", promotionsOnly: true },
  { query: "rib eye", department: "Butcher", promotionsOnly: true },
  { query: "rump steak", department: "Butcher", promotionsOnly: true },
  { query: "lamb chop", department: "Butcher", promotionsOnly: true },
  { query: "pork steak", department: "Butcher", promotionsOnly: true },
  { query: "rashers", department: "Butcher", promotionsOnly: true },
  { query: "sausages", department: "Butcher", promotionsOnly: true },
  { query: "wine", department: "Wine", promotionsOnly: true, alcoholOnly: true },
  { query: "beer", department: "Beer", promotionsOnly: true, alcoholOnly: true },
  { query: "spirits", department: "Spirits", promotionsOnly: true, alcoholOnly: true },
  { query: "apples", department: "Fresh Fruit & Veg", promotionsOnly: true },
  { query: "potatoes", department: "Fresh Fruit & Veg", promotionsOnly: true },
  { query: "fish counter", department: "Fish Counter", promotionsOnly: true },
  { query: "salmon", department: "Fish & Seafood", promotionsOnly: true },
  { query: "cod", department: "Fish & Seafood", promotionsOnly: true },
  { query: "prawns", department: "Fish Counter", promotionsOnly: true },
];

export const SUPERVALU_SERVICE_AREA_MIN_COUNTS: Record<string, number> = {
  butcher: 5,
  deli: 3,
  fish: 3,
  produce: 3,
  bakery: 0,
  off_licence: 1,
  grocery: 50,
};
