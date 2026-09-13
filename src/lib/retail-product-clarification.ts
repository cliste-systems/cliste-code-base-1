import {
  stripCatalogPackagingNoise,
  stripCatalogSearchBoilerplate,
} from "@/lib/supervalu-catalog-search";
import {
  inferWeeklyOfferFulfilmentFromQuery,
  offerSearchProductTokens,
  tokenizeSupervaluSearchQuery,
} from "@/lib/retail-weekly-offers-search";

export type ClarificationMatch = {
  productName?: string;
  product_name?: string;
  service_area?: string | null;
  serviceArea?: string | null;
  fulfilment?: string | null;
};

/** Caller named a category, not a specific brand/type/size. */
export function isBroadProductQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const core =
    stripCatalogPackagingNoise(stripCatalogSearchBoilerplate(trimmed)) || trimmed;
  const tokens = tokenizeSupervaluSearchQuery(core);
  return tokens.length > 0 && tokens.length <= 2;
}

function shortProductLabel(productName: string): string {
  return productName
    .replace(/\([^)]*\)\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
}

function distinctProductLabels(matches: ClarificationMatch[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const match of matches) {
    const name = String(match.productName ?? match.product_name ?? "").trim();
    if (!name) continue;
    const label = shortProductLabel(name);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function matchFulfilment(match: ClarificationMatch): string {
  return String(match.fulfilment ?? "").trim().toLowerCase();
}

function matchServiceArea(match: ClarificationMatch): string {
  return String(match.serviceArea ?? match.service_area ?? "")
    .trim()
    .toLowerCase();
}

/** When the caller already said counter/loose/pre-pack, narrow matches before clarifying. */
export function filterOfferMatchesByInferredFulfilment<T extends ClarificationMatch>(
  query: string,
  matches: T[],
): T[] {
  const implied = inferWeeklyOfferFulfilmentFromQuery(query);
  let narrowed = implied
    ? matches.filter((match) => matchFulfilment(match) === implied)
    : matches;
  if (narrowed.length === 0) narrowed = matches;

  const productTokens = offerSearchProductTokens(query);
  if (productTokens.length === 0 || narrowed.length <= 1) return narrowed;

  const byProductName = narrowed.filter((match) => {
    const name = String(match.productName ?? match.product_name ?? "").toLowerCase();
    return productTokens.some((token) => {
      const stem = token.replace(/s$/, "");
      return name.includes(stem);
    });
  });
  return byProductName.length > 0 ? byProductName : narrowed;
}

/** Counter vs pre-pack weekly offers both match — ask which before quoting. */
export function buildOfferFulfilmentClarificationHint(
  matches: ClarificationMatch[],
): string | null {
  if (matches.length < 2) return null;

  const fulfilments = new Set(matches.map((match) => matchFulfilment(match)).filter(Boolean));
  if (!fulfilments.has("counter") || !fulfilments.has("prepack")) return null;

  const counterExample = matches.find((match) => matchFulfilment(match) === "counter");
  const prepackExample = matches.find((match) => matchFulfilment(match) === "prepack");
  const counterArea = matchServiceArea(counterExample ?? {});
  const prepackArea = matchServiceArea(prepackExample ?? {});

  let areaHint = "counter (by weight) or pre-pack (packaged)";
  if (counterArea === "fish" || prepackArea === "fish") {
    areaHint = "fish counter (loose/by weight) or pre-pack fish (packaged)";
  } else if (counterArea === "butcher" || prepackArea === "butcher") {
    areaHint = "butcher counter (by weight) or pre-pack meat (packaged)";
  } else if (counterArea === "deli" || prepackArea === "deli") {
    areaHint = "deli counter (sliced/by weight) or chilled pre-pack";
  }

  return (
    "Both counter and pre-pack options are on offer this week — ask ONE short clarifying question: " +
    `does the caller mean ${areaHint}? Do not quote a specific price until they choose.`
  );
}

/** When several types/brands match a broad query, Cara should ask one clarifying question first. */
export function buildBroadProductClarificationHint(
  query: string,
  matches: ClarificationMatch[],
): string | null {
  if (inferWeeklyOfferFulfilmentFromQuery(query)) return null;
  if (!isBroadProductQuery(query)) return null;
  if (matches.length < 3) return null;

  const labels = distinctProductLabels(matches);
  if (labels.length < 2) return null;

  const examples = labels.slice(0, 4).join("; ");
  return (
    "Several types or brands match — ask ONE short clarifying question: which type or brand they mean " +
    `(for example: ${examples}). Do not quote a specific price until they narrow it down.`
  );
}

export function buildProductClarificationHint(
  query: string,
  matches: ClarificationMatch[],
): string | null {
  const narrowed = filterOfferMatchesByInferredFulfilment(query, matches);
  return (
    buildOfferFulfilmentClarificationHint(narrowed) ??
    buildBroadProductClarificationHint(query, narrowed)
  );
}

export function resolveProductSearchResponse<T extends ClarificationMatch>(
  query: string,
  matches: T[],
): { matches: T[]; clarificationHint: string | null } {
  const narrowed = filterOfferMatchesByInferredFulfilment(query, matches);
  const clarificationHint =
    buildOfferFulfilmentClarificationHint(narrowed) ??
    buildBroadProductClarificationHint(query, narrowed);
  return {
    clarificationHint,
    matches: clarificationHint ? [] : narrowed,
  };
}
