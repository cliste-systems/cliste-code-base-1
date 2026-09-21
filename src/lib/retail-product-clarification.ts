import {
  stripCatalogPackagingNoise,
  stripCatalogSearchBoilerplate,
} from "@/lib/supervalu-catalog-search";
import {
  inferWeeklyOffersListIntent,
  offerSearchProductTokens,
  tokenizeSupervaluSearchQuery,
} from "@/lib/retail-weekly-offers-search";
import { retailSearchTokenMatchesText } from "@/lib/retail-search-fuzzy";
import type { SupervaluFulfilment } from "@/lib/supervalu-offers-types";

export type ClarificationMatch = {
  productName?: string;
  product_name?: string;
  service_area?: string | null;
  serviceArea?: string | null;
  fulfilment?: string | null;
};

const COUNTER_PREPACK_AREA_HINTS: Record<string, string> = {
  butcher:
    "fresh at the butcher counter, priced per kilo, or the pre-pack packs in the meat aisle",
  fish: "fresh at the fish counter, or the pre-pack packs in the fish aisle",
  deli: "fresh sliced at the deli counter, or the chilled pre-pack packs",
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

function fulfilmentClarificationAreaHint(serviceArea: string): string {
  return (
    COUNTER_PREPACK_AREA_HINTS[serviceArea] ??
    "fresh at the counter, or the pre-pack packs in the aisle"
  );
}

function narrowMatchesByProductTokens<T extends ClarificationMatch>(
  query: string,
  matches: T[],
): T[] {
  if (inferWeeklyOffersListIntent(query)) return matches;

  const productTokens = offerSearchProductTokens(query);
  if (productTokens.length === 0 || matches.length <= 1) return matches;

  const byProductName = matches.filter((match) => {
    const name = String(match.productName ?? match.product_name ?? "");
    if (productTokens.length >= 2) {
      return productTokens.every((token) => retailSearchTokenMatchesText(name, token));
    }
    return productTokens.some((token) => retailSearchTokenMatchesText(name, token));
  });
  return byProductName;
}

/** Narrow to counter or pre-pack only when the tool was called with an explicit fulfilment choice. */
export function filterOfferMatchesByExplicitFulfilment<T extends ClarificationMatch>(
  matches: T[],
  explicitFulfilment?: SupervaluFulfilment | null,
): T[] {
  if (!explicitFulfilment) return matches;
  const narrowed = matches.filter(
    (match) => matchFulfilment(match) === explicitFulfilment,
  );
  return narrowed.length > 0 ? narrowed : matches;
}

/** @deprecated Use filterOfferMatchesByExplicitFulfilment — query text is not used for fulfilment. */
export function filterOfferMatchesByInferredFulfilment<T extends ClarificationMatch>(
  _query: string,
  matches: T[],
  explicitFulfilment?: SupervaluFulfilment | null,
): T[] {
  return filterOfferMatchesByExplicitFulfilment(matches, explicitFulfilment);
}

/** Counter vs pre-pack weekly offers both match — ask which before quoting. */
export function buildOfferFulfilmentClarificationHint(
  matches: ClarificationMatch[],
  explicitFulfilment?: SupervaluFulfilment | null,
): string | null {
  if (explicitFulfilment) return null;
  if (matches.length < 2) return null;

  const areas = new Set(
    matches.map((match) => matchServiceArea(match)).filter(Boolean),
  );
  if (areas.size !== 1) return null;

  const fulfilments = new Set(matches.map((match) => matchFulfilment(match)).filter(Boolean));
  if (!fulfilments.has("counter") || !fulfilments.has("prepack")) return null;

  const serviceArea = [...areas][0] ?? "";
  const areaHint = fulfilmentClarificationAreaHint(serviceArea);

  return (
    "Both fresh counter and pre-pack options are on offer this week — ask ONE short clarifying question, for example: " +
    `"Do you mean ${areaHint}?" Do NOT quote any prices or product names until they choose. Then call the tool again with fulfilment set to counter or prepack.`
  );
}

/** When several types/brands match a broad query, Cara should ask one clarifying question first. */
export function buildBroadProductClarificationHint(
  query: string,
  matches: ClarificationMatch[],
): string | null {
  if (inferWeeklyOffersListIntent(query)) return null;
  if (!isBroadProductQuery(query)) return null;
  if (matches.length < 2) return null;

  const labels = distinctProductLabels(matches);
  if (labels.length < 2) return null;

  const productTokens = offerSearchProductTokens(query);
  if (productTokens.length > 0) {
    const relevant = matches.filter((match) => {
      const name = String(match.productName ?? match.product_name ?? "").toLowerCase();
      return productTokens.some((token) => {
        const stem = token.replace(/s$/, "");
        return name.includes(stem);
      });
    });
    if (relevant.length < 2) return null;
  }

  const examples = labels.slice(0, 4).join("; ");
  return (
    "Several types or brands match — ask ONE short clarifying question: which type or brand they mean " +
    `(for example: ${examples}). Do not quote a specific price until they narrow it down.`
  );
}

export function buildProductClarificationHint(
  query: string,
  matches: ClarificationMatch[],
  explicitFulfilment?: SupervaluFulfilment | null,
): string | null {
  const narrowed = filterOfferMatchesByExplicitFulfilment(matches, explicitFulfilment);
  return (
    buildOfferFulfilmentClarificationHint(narrowed, explicitFulfilment) ??
    buildBroadProductClarificationHint(query, narrowed)
  );
}

export function resolveProductSearchResponse<T extends ClarificationMatch>(
  query: string,
  matches: T[],
  options?: { fulfilment?: SupervaluFulfilment | null },
): { matches: T[]; clarificationHint: string | null } {
  let narrowed = filterOfferMatchesByExplicitFulfilment(
    matches,
    options?.fulfilment,
  );
  narrowed = narrowMatchesByProductTokens(query, narrowed);
  const clarificationHint =
    buildOfferFulfilmentClarificationHint(narrowed, options?.fulfilment) ??
    buildBroadProductClarificationHint(query, narrowed);
  return {
    clarificationHint,
    matches: narrowed,
  };
}
