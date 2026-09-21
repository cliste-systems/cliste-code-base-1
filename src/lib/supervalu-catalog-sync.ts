import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchSupervaluGatewayJson,
  SUPERVALU_GATEWAY_BASE,
  SUPERVALU_GATEWAY_PAGE_SIZE,
} from "@/lib/supervalu-gateway";
import {
  classifySupervaluOfferServiceArea,
  currentSupervaluOfferWeek,
  isPromotionalSupervaluProduct,
  normalizeSearchText,
} from "@/lib/supervalu-offers-normalize";
import {
  SUPERVALU_STOREFRONT_STORE_ID,
  type SupervaluGatewayProduct,
} from "@/lib/supervalu-offers-types";

/**
 * SuperValu's current top-level online-shopping aisles.
 * Keep these IDs aligned with the live storefront navigation; a full-catalogue
 * sync is rejected if it comes back implausibly small.
 */
const ROOT_CATEGORIES = [
  { categoryId: "O100001", department: "Fruit & Vegetables" },
  { categoryId: "O100010", department: "Bakery" },
  { categoryId: "O100015", department: "Meat & Poultry" },
  { categoryId: "O100017", department: "Fish & Seafood" },
  { categoryId: "O100020", department: "Deli Counter" },
  { categoryId: "O100023", department: "Cheese" },
  { categoryId: "O100025", department: "Milk, Yogurt, Butter & Eggs" },
  { categoryId: "O100027", department: "Health & Wellness" },
  { categoryId: "O100030", department: "Chilled Food" },
  { categoryId: "O100035", department: "Food Cupboard" },
  { categoryId: "O100045", department: "Frozen Foods" },
  { categoryId: "O100050", department: "Drinks" },
  { categoryId: "O100055", department: "Beauty & Personal Care" },
  { categoryId: "O100060", department: "Baby" },
  { categoryId: "O100065", department: "Household & Cleaning" },
  { categoryId: "O100070", department: "Pets" },
  { categoryId: "O100075", department: "Wine, Beer & Spirits" },
  { categoryId: "O100080", department: "Newsagent & Tobacconist" },
] as const;

const MIN_FULL_CATALOG_PRODUCTS = 5000;

type CatalogProduct = {
  sku: string;
  productName: string;
  brand: string | null;
  department: string;
  categoryBreadcrumb: string | null;
  serviceArea: "butcher" | "deli" | "fish" | "produce" | "bakery" | "off_licence" | "grocery";
  fulfilment: "counter" | "prepack";
  sellBy: string | null;
  priceUnitType: string | null;
  isAlcohol: boolean;
  sourceUrl: string | null;
  searchText: string;
  regularPriceEur: number | null;
  displayPriceEur: number | null;
  pricePerUnit: string | null;
  priceLabel: string | null;
  priceSource: string | null;
  promotion: null | {
    type: "loyalty" | "standard_offer" | "multibuy" | "percentage" | "other";
    loyaltyRequired: boolean;
    loyaltyProgram: string | null;
    offerPriceEur: number | null;
    regularPriceEur: number | null;
    label: string | null;
    description: string | null;
  };
};

function primaryBreadcrumb(product: SupervaluGatewayProduct): string {
  const direct = product.defaultCategory?.[0]?.categoryBreadcrumb;
  if (direct) return String(direct).trim();
  return [...(product.categories ?? [])]
    .map((c) => String(c.categoryBreadcrumb ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

function currentPrice(product: SupervaluGatewayProduct): number | null {
  const raw = Number(product.tprPrice?.[0]?.markdown ?? product.priceNumeric ?? product.wholePrice ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function promotionText(product: SupervaluGatewayProduct): string {
  return [
    product.tprPrice?.[0]?.label,
    product.priceLabel,
    product.promotions?.[0]?.name,
    product.promotions?.[0]?.description,
  ].filter(Boolean).join(" ").trim();
}

function classifyPromotion(product: SupervaluGatewayProduct, label: string): CatalogProduct["promotion"] {
  if (!isPromotionalSupervaluProduct(product)) return null;
  const offer = currentPrice(product);
  const was = Number(product.wasPriceNumeric ?? 0);
  const regular = Number.isFinite(was) && was > 0 ? was : offer;
  const text = promotionText(product);
  const loyalty = /rewards?\s+price|real\s+rewards?/i.test(text);
  let type: NonNullable<CatalogProduct["promotion"]>["type"] = "standard_offer";
  if (loyalty) type = "loyalty";
  else if (/\b\d+\s+for\s+[€£]?\d+/i.test(text)) type = "multibuy";
  else if (/save\s+\d+\s*%/i.test(text)) type = "percentage";
  else if (!label && !product.priceSource && !(product.promotions?.length)) type = "other";
  return {
    type,
    loyaltyRequired: loyalty,
    loyaltyProgram: loyalty ? "Real Rewards" : null,
    offerPriceEur: offer,
    regularPriceEur: regular,
    label: label || null,
    description: String(product.promotions?.[0]?.description ?? "").trim() || null,
  };
}

function normalizeProduct(product: SupervaluGatewayProduct, fallbackDepartment: string): CatalogProduct | null {
  const sku = String(product.sku ?? product.productId ?? "").trim();
  const productName = String(product.name ?? "").trim();
  if (!sku || !productName) return null;
  const department = String(product.attributes?.altCategory ?? "").trim() || fallbackDepartment;
  const categoryBreadcrumb = primaryBreadcrumb(product) || null;
  const label = String(product.tprPrice?.[0]?.label ?? product.priceLabel ?? product.promotions?.[0]?.name ?? "").trim();
  const displayPriceEur = currentPrice(product);
  const promotion = classifyPromotion(product, label);
  const regularPriceEur = promotion?.regularPriceEur ?? displayPriceEur;
  const { serviceArea, fulfilment } = classifySupervaluOfferServiceArea({
    product,
    productName,
    department,
    discountLabel: label,
  });
  const isAlcohol =
    product.attributes?.["Alcohol Restricted"] === true ||
    /\/drinks\/(wine|beer|spirits|cider)|off[- ]licence/i.test(categoryBreadcrumb ?? "");
  const brand = String(product.brand ?? "").trim() || null;
  return {
    sku,
    productName,
    brand,
    department,
    categoryBreadcrumb,
    serviceArea,
    fulfilment,
    sellBy: String(product.sellBy ?? "").trim() || null,
    priceUnitType: String(product.unitOfPrice?.type ?? "").trim() || null,
    isAlcohol,
    sourceUrl: String(product.url ?? "").trim() || null,
    searchText: normalizeSearchText(
      [productName, brand, department, categoryBreadcrumb, sku].filter(Boolean).join(" "),
    ),
    regularPriceEur,
    displayPriceEur,
    pricePerUnit: String(product.pricePerUnit ?? "").trim() || null,
    priceLabel: label || null,
    priceSource: String(product.priceSource ?? "").trim() || null,
    promotion,
  };
}

async function fetchCategory(categoryId: string, department: string, storeId: string): Promise<CatalogProduct[]> {
  const out: CatalogProduct[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;
  while (skip < total) {
    const url =
      `${SUPERVALU_GATEWAY_BASE}/stores/${encodeURIComponent(storeId)}` +
      `/categories/${encodeURIComponent(categoryId)}/search` +
      `?take=${SUPERVALU_GATEWAY_PAGE_SIZE}&skip=${skip}&sort=ppfreq`;
    const payload = await fetchSupervaluGatewayJson(url);
    total = Number(payload.total ?? payload.count ?? 0);
    const items = payload.items ?? [];
    for (const item of items) {
      const normalized = normalizeProduct(item, department);
      if (normalized) out.push(normalized);
    }
    if (items.length < SUPERVALU_GATEWAY_PAGE_SIZE) break;
    skip += SUPERVALU_GATEWAY_PAGE_SIZE;
  }
  return out;
}

export async function fetchSupervaluFullCatalog(storeId = SUPERVALU_STOREFRONT_STORE_ID): Promise<CatalogProduct[]> {
  // Crawl aisles concurrently in small batches so a full 20k-ish catalogue
  // comfortably fits inside the serverless execution window without hammering
  // SuperValu's gateway with unbounded parallel requests.
  const bySku = new Map<string, CatalogProduct>();
  const concurrency = 4;

  for (let i = 0; i < ROOT_CATEGORIES.length; i += concurrency) {
    const roots = ROOT_CATEGORIES.slice(i, i + concurrency);
    const batches = await Promise.all(
      roots.map((root) => fetchCategory(root.categoryId, root.department, storeId)),
    );
    for (const products of batches) {
      for (const product of products) bySku.set(product.sku, product);
    }
  }

  return [...bySku.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

export async function syncSupervaluFullCatalog(
  supabase: SupabaseClient,
  options?: { storeId?: string },
): Promise<{ ok: true; productCount: number; promotionCount: number; syncBatchId: string } | { ok: false; message: string }> {
  const storeId = options?.storeId ?? SUPERVALU_STOREFRONT_STORE_ID;
  const syncBatchId = crypto.randomUUID();
  const syncedAt = new Date().toISOString();
  const week = currentSupervaluOfferWeek(new Date());

  await supabase.from("retail_catalog_sync_runs").insert({
    retail_banner: "supervalu",
    source_store_id: storeId,
    sync_batch_id: syncBatchId,
    status: "running",
    started_at: syncedAt,
  });

  try {
    const products = await fetchSupervaluFullCatalog(storeId);
    if (products.length < MIN_FULL_CATALOG_PRODUCTS) {
      throw new Error(
        `Full SuperValu catalogue unexpectedly small (${products.length} products; expected at least ${MIN_FULL_CATALOG_PRODUCTS})`,
      );
    }

    const productRows = products.map((p) => ({
      retail_banner: "supervalu",
      sku: p.sku,
      product_name: p.productName,
      brand: p.brand,
      department: p.department,
      category_breadcrumb: p.categoryBreadcrumb,
      service_area: p.serviceArea,
      fulfilment: p.fulfilment,
      sell_by: p.sellBy,
      price_unit_type: p.priceUnitType,
      is_alcohol: p.isAlcohol,
      source_url: p.sourceUrl,
      search_text: p.searchText,
      last_seen_at: syncedAt,
      updated_at: syncedAt,
    }));

    for (let i = 0; i < productRows.length; i += 500) {
      const { error } = await supabase
        .from("retail_catalog_products")
        .upsert(productRows.slice(i, i + 500), { onConflict: "retail_banner,sku" });
      if (error) throw new Error(error.message);
    }

    const skus = products.map((p) => p.sku);
    const idBySku = new Map<string, string>();
    for (let i = 0; i < skus.length; i += 500) {
      const { data, error } = await supabase
        .from("retail_catalog_products")
        .select("id,sku")
        .eq("retail_banner", "supervalu")
        .in("sku", skus.slice(i, i + 500));
      if (error) throw new Error(error.message);
      for (const row of data ?? []) idBySku.set(String(row.sku), String(row.id));
    }

    const storeRows = products.flatMap((p) => {
      const productId = idBySku.get(p.sku);
      if (!productId) return [];
      return [{
        product_id: productId,
        source_store_id: storeId,
        sync_batch_id: syncBatchId,
        regular_price_eur: p.regularPriceEur,
        display_price_eur: p.displayPriceEur,
        price_per_unit: p.pricePerUnit,
        source_price_label: p.priceLabel,
        source_price_source: p.priceSource,
        is_listed: true,
        synced_at: syncedAt,
        last_seen_at: syncedAt,
        updated_at: syncedAt,
      }];
    });

    for (let i = 0; i < storeRows.length; i += 500) {
      const { error } = await supabase
        .from("retail_store_products")
        .upsert(storeRows.slice(i, i + 500), { onConflict: "source_store_id,product_id" });
      if (error) throw new Error(error.message);
    }

    const storeProductIds: Array<{ id: string; product_id: string }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("retail_store_products")
        .select("id,product_id")
        .eq("source_store_id", storeId)
        .eq("sync_batch_id", syncBatchId)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      const page = (data ?? []).map((row) => ({
        id: String(row.id),
        product_id: String(row.product_id),
      }));
      storeProductIds.push(...page);
      if (page.length < 1000) break;
    }
    const spByProductId = new Map(
      storeProductIds.map((r) => [r.product_id, r.id]),
    );

    const promoRows = products.flatMap((p) => {
      if (!p.promotion) return [];
      const productId = idBySku.get(p.sku);
      const storeProductId = productId ? spByProductId.get(productId) : null;
      if (!storeProductId) return [];
      const key = [
        p.promotion.type,
        week.start,
        p.promotion.offerPriceEur ?? "",
        p.promotion.label ?? "",
      ].join(":").slice(0, 240);
      return [{
        store_product_id: storeProductId,
        promotion_key: key,
        promotion_type: p.promotion.type,
        loyalty_required: p.promotion.loyaltyRequired,
        loyalty_program: p.promotion.loyaltyProgram,
        offer_price_eur: p.promotion.offerPriceEur,
        regular_price_eur: p.promotion.regularPriceEur,
        label: p.promotion.label,
        description: p.promotion.description,
        valid_from: week.start,
        valid_to: week.end,
        synced_at: syncedAt,
        source_metadata: { price_source: p.priceSource },
        updated_at: syncedAt,
      }];
    });

    // Each successful catalogue pass is authoritative for the current offer
    // week. Remove that week's previous snapshot first so an offer that
    // disappears between the 00:20 / 06:20 / 08:20 Thursday passes cannot
    // remain stale in Cara's answers.
    for (let i = 0; i < storeProductIds.length; i += 500) {
      const ids = storeProductIds.slice(i, i + 500).map((r) => r.id);
      const { error } = await supabase
        .from("retail_promotions")
        .delete()
        .in("store_product_id", ids)
        .gte("valid_to", week.start)
        .lte("valid_from", week.end);
      if (error) throw new Error(error.message);
    }

    for (let i = 0; i < promoRows.length; i += 500) {
      const { error } = await supabase
        .from("retail_promotions")
        .upsert(promoRows.slice(i, i + 500), { onConflict: "store_product_id,promotion_key" });
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("retail_store_products")
      .update({ is_listed: false, updated_at: syncedAt })
      .eq("source_store_id", storeId)
      .neq("sync_batch_id", syncBatchId);

    for (let i = 0; i < storeProductIds.length; i += 500) {
      const ids = storeProductIds.slice(i, i + 500).map((r) => r.id);
      const { error } = await supabase
        .from("retail_promotions")
        .delete()
        .in("store_product_id", ids)
        .lt("valid_to", week.start);
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("organizations")
      .update({
        catalog_synced_at: syncedAt,
        catalog_sync_source: "supervalu_storefront",
        updated_at: syncedAt,
      })
      .eq("niche", "retail")
      .eq("retail_banner", "supervalu")
      .or(`retail_source_store_id.eq.${storeId},retail_source_store_id.is.null`);

    await supabase
      .from("retail_catalog_sync_runs")
      .update({
        status: "completed",
        product_count: products.length,
        promotion_count: promoRows.length,
        completed_at: new Date().toISOString(),
        metadata: { root_categories: ROOT_CATEGORIES.length },
      })
      .eq("sync_batch_id", syncBatchId);

    return { ok: true, productCount: products.length, promotionCount: promoRows.length, syncBatchId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog sync failed";
    await supabase
      .from("retail_catalog_sync_runs")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_message: message })
      .eq("sync_batch_id", syncBatchId);
    return { ok: false, message };
  }
}
