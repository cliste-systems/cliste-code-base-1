
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "supabase";
import * as cheerio from "cheerio";

const DEFAULT_STORE_ID = "992";
const TAKE = 100;
const H = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
};
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Capability = {
  id: string;
  mode: "discover" | "work";
  source_store_id: string;
  sync_batch_id: string | null;
  work_limit: number;
};
type CategoryJob = {
  id: string;
  category_id: string;
  category_name: string;
  category_href: string;
  source_store_id: string;
  sync_batch_id: string;
  next_page: number;
  next_skip: number;
  pages_fetched: number;
  product_cards_seen: number;
  unique_skus_seen: number;
};

function clean(s: string | null | undefined) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function eur(s: string | null | undefined): number | null {
  const m = String(s ?? "").match(/€\s*([0-9]+(?:[.,][0-9]{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function currentOfferWeek(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diff = (x.getUTCDay() - 4 + 7) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  const end = new Date(x);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: x.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function publicCategoryUrl(storeId: string, href: string, page = 1, skip = 0) {
  let path: string;
  if (href.startsWith("http")) {
    path = new URL(href).pathname.replace(/^\/sm\/pickup\/rsid\/\d+/, "");
  } else {
    path = href;
  }
  if (!path.startsWith("/")) path = "/" + path;
  return `https://shop.supervalu.ie/sm/pickup/rsid/${encodeURIComponent(storeId)}${path}?page=${page}&skip=${skip}&take=${TAKE}`;
}
function classify(categoryName: string, href: string) {
  const x = `${categoryName} ${href}`.toLowerCase();
  let serviceArea = "grocery";
  if (/wine|beer|spirits|off.?licen|cider/.test(x)) serviceArea = "off_licence";
  else if (/deli/.test(x)) serviceArea = "deli";
  else if (/fish|seafood/.test(x)) serviceArea = "fish";
  else if (/meat|poultry|butcher|beef|pork|lamb|sausage|rasher/.test(x)) serviceArea = "butcher";
  else if (/fruit|vegetable|produce/.test(x)) serviceArea = "produce";
  else if (/bakery|bread|cake/.test(x)) serviceArea = "bakery";
  const explicitlyPrepack = /pre.?pack|packaged/.test(x);
  const counterPath =
    /\/butcher(?:\/|-)|\/deli-counter(?:\/|-)|\/fish-counter(?:\/|-)|\bcounter\b|\bloose\b|by.?weight/.test(x);
  const fulfilment = !explicitlyPrepack && counterPath ? "counter" : "prepack";
  return { serviceArea, fulfilment };
}
function parseCards(html: string, categoryName: string, href: string) {
  const $ = cheerio.load(html);
  const classification = classify(categoryName, href);
  const cards: any[] = [];
  $('article[data-testid^="ProductCardWrapper-"]').each((_i, el) => {
    const article = $(el);
    const sku = clean((article.attr("data-testid") ?? "").replace(/^ProductCardWrapper-/, ""));
    if (!sku) return;
    const nameNode = article.find(`[data-testid="${sku}-ProductNameTestId"]`).first().clone();
    nameNode.children().remove();
    const name = clean(nameNode.text()) || clean(article.find("img[alt]").first().attr("alt"));
    if (!name) return;
    const brand = clean(article.find('[data-testid="ProductCardAQABrand"]').first().text()) || null;
    const sourceUrl = article.find('a[href*="/product/"]').first().attr("href") || null;
    const titleText = clean(article.find(`#productCard_title__${sku} p`).first().text());
    const displayPrice = eur(titleText);
    const cardText = clean(article.text());
    const wasMatch = cardText.match(/\bwas\s*€\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
    const wasPrice = wasMatch ? Number(wasMatch[1].replace(",", ".")) : null;
    const regularPrice =
      (Number.isFinite(wasPrice) && wasPrice! > 0 ? wasPrice : null) ??
      eur(article.find('[class*="ProductPrice--"]').first().text()) ??
      displayPrice;
    const unitPrice = clean(article.find('[class*="ProductUnitPrice--"]').first().text()) || null;
    const badges = article.find('[data-testid^="promotionBadge-"]').toArray()
      .map((b) => clean($(b).attr("title") || $(b).text()))
      .filter(Boolean);
    cards.push({
      sku, name, brand, sourceUrl, displayPrice, regularPrice, unitPrice, badges,
      isAlcohol: classification.serviceArea === "off_licence",
      searchText: clean([name, brand, categoryName, href, sku].filter(Boolean).join(" ")).toLowerCase(),
      ...classification,
    });
  });
  return cards;
}
function promoRows(card: any, storeProductId: string, week: {start:string,end:string}, now: string) {
  return card.badges.map((label: string) => {
    const loyalty = /rewards?\s+price|real\s+rewards?/i.test(label);
    const multi = label.match(/\b(\d+)\s+for\s+€\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
    let promotionType = "standard_offer";
    if (multi) promotionType = "multibuy";
    else if (loyalty) promotionType = "loyalty";
    else if (/save\s+\d+\s*%/i.test(label)) promotionType = "percentage";
    let offerPrice = multi ? null : eur(label);
    if (offerPrice == null && loyalty && card.displayPrice != null && card.displayPrice !== card.regularPrice) {
      offerPrice = card.displayPrice;
    }
    const metadata: Record<string, unknown> = { source: "supervalu_public_storefront" };
    if (multi) {
      metadata.multibuy_quantity = Number(multi[1]);
      metadata.multibuy_total_eur = Number(multi[2].replace(",", "."));
    }
    return {
      store_product_id: storeProductId,
      promotion_key: [promotionType, week.start, label].join(":").slice(0, 240),
      promotion_type: promotionType,
      loyalty_required: loyalty,
      loyalty_program: loyalty ? "Real Rewards" : null,
      offer_price_eur: offerPrice,
      regular_price_eur: card.regularPrice,
      label,
      description: null,
      valid_from: week.start,
      valid_to: week.end,
      synced_at: now,
      source_metadata: metadata,
      updated_at: now,
    };
  });
}
async function consumeCapability(requestId: string): Promise<Capability> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("retail_catalog_bootstrap_requests")
    .select("id,mode,source_store_id,sync_batch_id,work_limit,expires_at,used_at")
    .eq("id", requestId)
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (error) throw new Error("capability lookup: " + error.message);
  if (!data) throw new Error("invalid or expired capability");
  const { data: used, error: ue } = await supabase
    .from("retail_catalog_bootstrap_requests")
    .update({ used_at: now })
    .eq("id", requestId)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (ue) throw new Error("capability consume: " + ue.message);
  if (!used) throw new Error("capability already consumed");
  return data as Capability;
}
async function upsertCards(cards: any[], job: CategoryJob, batchId: string) {
  if (!cards.length) return { unique: 0, promotions: 0 };
  const now = new Date().toISOString();
  const productRows = cards.map((c) => ({
    retail_banner: "supervalu",
    sku: c.sku,
    product_name: c.name,
    brand: c.brand,
    department: job.category_name,
    category_breadcrumb: job.category_href,
    service_area: c.serviceArea,
    fulfilment: c.fulfilment,
    is_alcohol: c.isAlcohol,
    source_url: c.sourceUrl,
    search_text: c.searchText,
    last_seen_at: now,
    updated_at: now,
  }));
  const { error: pe } = await supabase.from("retail_catalog_products")
    .upsert(productRows, { onConflict: "retail_banner,sku" });
  if (pe) throw new Error("product upsert: " + pe.message);

  const skus = [...new Set(cards.map((c) => c.sku))];
  const { data: ids, error: ie } = await supabase.from("retail_catalog_products")
    .select("id,sku").eq("retail_banner", "supervalu").in("sku", skus);
  if (ie) throw new Error("product id lookup: " + ie.message);
  const idBySku = new Map((ids ?? []).map((r:any) => [String(r.sku), String(r.id)]));

  const listings = cards.flatMap((c) => {
    const productId = idBySku.get(c.sku);
    if (!productId) return [];
    return [{
      product_id: productId,
      source_store_id: job.source_store_id,
      sync_batch_id: batchId,
      regular_price_eur: c.regularPrice,
      display_price_eur: c.displayPrice,
      price_per_unit: c.unitPrice,
      source_price_label: c.badges.join(" | ") || null,
      source_price_source: "supervalu_public_storefront",
      is_listed: true,
      synced_at: now,
      last_seen_at: now,
      updated_at: now,
    }];
  });
  const { error: le } = await supabase.from("retail_store_products")
    .upsert(listings, { onConflict: "source_store_id,product_id" });
  if (le) throw new Error("listing upsert: " + le.message);

  const productIds = listings.map((x:any) => x.product_id);
  const { data: storeRows, error: se } = await supabase.from("retail_store_products")
    .select("id,product_id").eq("source_store_id", job.source_store_id).in("product_id", productIds);
  if (se) throw new Error("store listing lookup: " + se.message);
  const spByProduct = new Map((storeRows ?? []).map((r:any) => [String(r.product_id), String(r.id)]));
  const week = currentOfferWeek();
  const affected = (storeRows ?? []).map((r:any) => String(r.id));
  if (affected.length) {
    const { error: de } = await supabase.from("retail_promotions")
      .delete().in("store_product_id", affected)
      .gte("valid_to", week.start).lte("valid_from", week.end);
    if (de) throw new Error("promotion clear: " + de.message);
  }
  const promotions: any[] = [];
  for (const card of cards) {
    const productId = idBySku.get(card.sku);
    const storeProductId = productId ? spByProduct.get(productId) : null;
    if (storeProductId) promotions.push(...promoRows(card, storeProductId, week, now));
  }
  if (promotions.length) {
    const { error: pre } = await supabase.from("retail_promotions")
      .upsert(promotions, { onConflict: "store_product_id,promotion_key" });
    if (pre) throw new Error("promotion upsert: " + pre.message);
  }
  return { unique: skus.length, promotions: promotions.length };
}
async function discover(storeId: string) {
  const navUrl = `https://shop.supervalu.ie/sm/pickup/rsid/${encodeURIComponent(storeId)}/categories/milk-yogurt-butter-eggs-id-O100025`;
  const response = await fetch(navUrl, { headers: H });
  if (!response.ok) throw new Error("navigation HTTP " + response.status);
  const html = await response.text();
  const $ = cheerio.load(html);
  const found = new Map<string, {category_id:string,category_name:string,category_href:string}>();
  $('a[href*="/categories/"]').each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/-id-(O\d+)/);
    if (!match) return;
    const categoryId = match[1];
    if (categoryId.startsWith("O1")) return;
    if (!found.has(categoryId)) {
      found.set(categoryId, {
        category_id: categoryId,
        category_name: clean($(el).text()) || categoryId,
        category_href: href,
      });
    }
  });
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: runError } = await supabase.from("retail_catalog_sync_runs").insert({
    retail_banner: "supervalu",
    source_store_id: storeId,
    sync_batch_id: batchId,
    status: "running",
    started_at: now,
    metadata: { source: "supervalu_public_storefront", category_count: found.size },
  });
  if (runError) throw new Error("sync run insert: " + runError.message);

  const queueRows = [...found.values()].map((c) => ({
    retail_banner: "supervalu",
    source_store_id: storeId,
    sync_batch_id: batchId,
    ...c,
    status: "pending",
    pages_fetched: 0,
    product_cards_seen: 0,
    unique_skus_seen: 0,
    last_error: null,
    started_at: null,
    completed_at: null,
    updated_at: now,
  }));
  for (let i = 0; i < queueRows.length; i += 200) {
    const { error } = await supabase.from("retail_catalog_category_queue")
      .upsert(queueRows.slice(i, i + 200), { onConflict: "source_store_id,category_id" });
    if (error) throw new Error("queue upsert: " + error.message);
  }
  return { batch_id: batchId, categories: queueRows.length };
}
async function processJob(job: CategoryJob, batchId: string) {
  try {
    const page = Number(job.next_page || 1);
    const skip = Number(job.next_skip || 0);
    const url = publicCategoryUrl(job.source_store_id, job.category_href, page, skip);
    const response = await fetch(url, { headers: H });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const cards = parseCards(html, job.category_name, job.category_href);
    const saved = await upsertCards(cards, job, batchId);
    const $ = cheerio.load(html);
    const next = $('link[rel="next"]').attr("href");
    const hasNext = Boolean(next) && cards.length > 0;
    const now = new Date().toISOString();
    await supabase.from("retail_catalog_category_queue").update({
      status: hasNext ? "pending" : "completed",
      pages_fetched: Number(job.pages_fetched || 0) + 1,
      product_cards_seen: Number(job.product_cards_seen || 0) + cards.length,
      unique_skus_seen: Number(job.unique_skus_seen || 0) + saved.unique,
      next_page: hasNext ? page + 1 : page,
      next_skip: hasNext ? skip + TAKE : skip,
      completed_at: hasNext ? null : now,
      updated_at: now,
      last_error: null,
    }).eq("id", job.id);
    return {
      category_id: job.category_id,
      page,
      cards: cards.length,
      promotions: saved.promotions,
      has_next: hasNext,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("retail_catalog_category_queue").update({
      status: "failed",
      last_error: message,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    return { category_id: job.category_id, error: message };
  }
}
async function work(storeId: string, batchId: string, _limit: number) {
  const { data, error } = await supabase.rpc("claim_retail_catalog_categories", {
    p_source_store_id: storeId,
    p_sync_batch_id: batchId,
    p_limit: 1,
  });
  if (error) throw new Error("category claim: " + error.message);
  const jobs = (data ?? []) as CategoryJob[];
  const results = [];
  for (const job of jobs) results.push(await processJob(job, batchId));

  const { count: remaining, error: remainingError } = await supabase
    .from("retail_catalog_category_queue")
    .select("id", { count: "exact", head: true })
    .eq("source_store_id", storeId)
    .eq("sync_batch_id", batchId)
    .in("status", ["pending", "running"]);
  if (remainingError) throw new Error("queue completion check: " + remainingError.message);

  let nationalRefresh: unknown = null;
  if ((remaining ?? 0) === 0) {
    const { count: failed, error: failedError } = await supabase
      .from("retail_catalog_category_queue")
      .select("id", { count: "exact", head: true })
      .eq("source_store_id", storeId)
      .eq("sync_batch_id", batchId)
      .eq("status", "failed");
    if (failedError) throw new Error("queue failure check: " + failedError.message);

    const completedAt = new Date().toISOString();
    if ((failed ?? 0) === 0) {
      const { data: refresh, error: refreshError } = await supabase.rpc(
        "refresh_supervalu_national_scope",
      );
      if (refreshError) throw new Error("national refresh: " + refreshError.message);
      nationalRefresh = refresh;

      const { count: productCount } = await supabase
        .from("retail_store_products")
        .select("id", { count: "exact", head: true })
        .eq("source_store_id", storeId)
        .eq("is_listed", true);

      await supabase.from("retail_catalog_sync_runs").update({
        status: "completed",
        product_count: productCount ?? 0,
        completed_at: completedAt,
        error_message: null,
      }).eq("sync_batch_id", batchId);
    } else {
      await supabase.from("retail_catalog_sync_runs").update({
        status: "failed",
        completed_at: completedAt,
        error_message: `${failed} category jobs failed`,
      }).eq("sync_batch_id", batchId);
    }
  }

  return { claimed: jobs.length, results, remaining: remaining ?? 0, national_refresh: nationalRefresh };
}

Deno.serve(async (req) => {
  let requestId = "";
  try {
    const body = await req.json().catch(() => ({}));
    requestId = clean(body.request_id);
    if (!requestId) return Response.json({ ok: false, error: "request_id required" }, { status: 401 });
    const capability = await consumeCapability(requestId);
    let result: any;
    if (capability.mode === "discover") {
      result = await discover(capability.source_store_id || DEFAULT_STORE_ID);
    } else {
      if (!capability.sync_batch_id) throw new Error("work capability missing sync batch");
      result = await work(capability.source_store_id, capability.sync_batch_id, capability.work_limit);
    }
    await supabase.from("retail_catalog_bootstrap_requests").update({
      result_status: 200,
      result_summary: result,
    }).eq("id", requestId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (requestId) {
      await supabase.from("retail_catalog_bootstrap_requests").update({
        result_status: 500,
        result_summary: { error: message },
      }).eq("id", requestId);
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
