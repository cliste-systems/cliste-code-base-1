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

/** Strip offer/price phrasing so gateway search matches product names. */
export function stripCatalogSearchBoilerplate(query: string): string {
  return query
    .replace(
      /\b(on offer|this week|any offers?|special|promotion|promo|deal|reduced|how much is|how much|what(?:'s| is) the price|what(?:'s| is) the cost|price of|cost of|do you stock|do you sell|do you carry|are they on|is it on)\b/gi,
      " ",
    )
    .replace(/^(?:is|are|the|a|an)\b\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Strip packaging / aisle phrasing callers use — not product names on the gateway. */
export function stripCatalogPackagingNoise(query: string): string {
  return query
    .replace(
      /\b(packets?|packs?|pre\s*-?\s*pack(?:ed|s)?|packaged|chilled|aisle|tray|fridge|shelf|counter|loose|fresh sliced)\b/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Expand caller phrasing into gateway queries that actually return results. */
export function expandSupervaluCatalogSearchQueries(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const boilerplate = stripCatalogSearchBoilerplate(trimmed) || trimmed;
  const core = stripCatalogPackagingNoise(boilerplate) || boilerplate;
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(normalized);
  };

  if (core !== boilerplate && core !== trimmed) add(core);
  if (boilerplate !== trimmed) add(boilerplate);
  add(trimmed);

  const tokens = tokenizeSupervaluSearchQuery(core);
  if (tokens.length >= 2) {
    add(tokens.slice(0, 2).join(" "));
    add(tokens[0]!);
  } else if (tokens.length === 1) {
    add(tokens[0]!);
  }

  if (/sriracha/i.test(trimmed)) {
    add(trimmed.replace(/sriracha/gi, "chilli"));
    if (/hellmann/i.test(trimmed)) {
      add("Hellmann's chilli");
    }
  }

  return ordered;
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

export function inferCatalogOfferBrowseCategories(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  const tokens = tokenizeSupervaluSearchQuery(trimmed);
  const categoryHints = new Set([
    "milk",
    "bread",
    "crisps",
    "chocolate",
    "fruit",
    "yogurt",
    "cheese",
    "butter",
    "tea",
    "coffee",
    "biscuits",
    "sweets",
    "confectionery",
  ]);
  const fromTokens = tokens.filter((token) => categoryHints.has(token));
  if (fromTokens.length >= 2) return fromTokens.slice(0, 5);
  if (/confectionery|sweets|candy/.test(trimmed)) return ["chocolate", "sweets"];
  if (
    /\blist\b|\bfive\b|\b5\b|apart from meat|what.*on offer|sample|best deal|weekly offers/i.test(
      trimmed,
    )
  ) {
    return ["chocolate", "crisps", "yogurt", "bread", "fruit"];
  }
  return [];
}

function scoreGatewayItems(
  items: Awaited<ReturnType<typeof fetchSupervaluGatewaySearch>>,
  tokens: string[],
): { product: SupervaluCatalogProduct; score: number }[] {
  return items
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
}

function isStrongCatalogMatch(
  scored: { score: number }[],
  tokens: string[],
): boolean {
  if (scored.length === 0) return false;
  if (tokens.length <= 1) return scored[0]!.score >= 0.5;
  return scored[0]!.score > 0.5;
}

async function searchSupervaluCatalogLiveSingle(
  query: string,
  options?: { storeId?: string; intent?: CatalogQuoteIntent },
): Promise<SupervaluCatalogMatch[]> {
  const trimmed = query.trim().slice(0, SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS);
  if (!trimmed) return [];

  const intent = options?.intent ?? inferCatalogSearchIntent(trimmed);
  const productQuery = stripCatalogSearchBoilerplate(trimmed) || trimmed;
  const coreQuery = stripCatalogPackagingNoise(productQuery) || productQuery;
  const tokens = tokenizeSupervaluSearchQuery(coreQuery);
  if (tokens.length === 0) return [];

  const candidates = expandSupervaluCatalogSearchQueries(trimmed);
  let bestScored: { product: SupervaluCatalogProduct; score: number }[] = [];

  for (const candidate of candidates) {
    const items = await fetchSupervaluGatewaySearch({
      query: candidate,
      storeId: options?.storeId,
    });
    const scored = scoreGatewayItems(items, tokens);
    // #region agent log
    fetch('http://127.0.0.1:7662/ingest/95496c05-1739-4e32-b7be-319b56b1c5b5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f50f3'},body:JSON.stringify({sessionId:'0f50f3',runId:'pre-fix',hypothesisId:'A',location:'supervalu-catalog-search.ts:gateway-candidate',message:'catalog gateway candidate',data:{trimmed,candidate,coreQuery,tokens,gatewayCount:items.length,topHit:scored[0]?.product.productName??null,topScore:scored[0]?.score??null,topDept:scored[0]?.product.department??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (scored.length === 0) continue;
    if (
      !bestScored[0] ||
      scored[0]!.score > bestScored[0]!.score ||
      (scored[0]!.score === bestScored[0]!.score &&
        scored.length > bestScored.length)
    ) {
      bestScored = scored;
    }
    if (isStrongCatalogMatch(scored, tokens)) break;
  }

  const scored = bestScored;
  // #region agent log
  fetch('http://127.0.0.1:7662/ingest/95496c05-1739-4e32-b7be-319b56b1c5b5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0f50f3'},body:JSON.stringify({sessionId:'0f50f3',runId:'pre-fix',hypothesisId:'C',location:'supervalu-catalog-search.ts:final-scored',message:'catalog search final matches',data:{trimmed,coreQuery,matchCount:scored.length,topHits:scored.slice(0,3).map((entry)=>({name:entry.product.productName,dept:entry.product.department,score:entry.score}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

export async function searchSupervaluCatalogLive(
  query: string,
  options?: { storeId?: string; intent?: CatalogQuoteIntent },
): Promise<SupervaluCatalogMatch[]> {
  const trimmed = query.trim().slice(0, SUPERVALU_CATALOG_SEARCH_MAX_QUERY_CHARS);
  if (!trimmed) return [];

  const intent = options?.intent ?? inferCatalogSearchIntent(trimmed);
  const browseCategories =
    intent === "offer" ? inferCatalogOfferBrowseCategories(trimmed) : [];

  if (browseCategories.length >= 2) {
    const seen = new Set<string>();
    const matches: SupervaluCatalogMatch[] = [];
    for (const category of browseCategories) {
      const categoryMatches = await searchSupervaluCatalogLiveSingle(category, {
        ...options,
        intent: "offer",
      });
      for (const match of categoryMatches) {
        if (!match.isOnOffer) continue;
        const key = match.sku ?? match.productName;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push(match);
        if (matches.length >= SUPERVALU_CATALOG_SEARCH_MAX_RESULTS) {
          return matches;
        }
      }
    }
    if (matches.length > 0) return matches;
  }

  return searchSupervaluCatalogLiveSingle(trimmed, options);
}
