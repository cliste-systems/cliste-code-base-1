import {
  catalogProductTokens,
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
  department?: string | null;
  service_area?: string | null;
  serviceArea?: string | null;
  fulfilment?: string | null;
};

export type ProductClarificationKind = "fulfilment" | "refinement";

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

function fulfilmentClarificationAreaHint(serviceArea: string): string | null {
  return COUNTER_PREPACK_AREA_HINTS[serviceArea] ?? null;
}

function queryMatchesDepartmentScope(
  query: string,
  matches: ClarificationMatch[],
): boolean {
  const tokens = offerSearchProductTokens(query);
  if (tokens.length === 0 || tokens.length > 3 || matches.length < 2) return false;
  return (
    matches.filter((match) => {
      const department = String(match.department ?? "");
      return tokens.every((token) =>
        retailSearchTokenMatchesText(department, token),
      );
    }).length >= 2
  );
}

function narrowMatchesByProductTokens<T extends ClarificationMatch>(
  query: string,
  matches: T[],
): T[] {
  if (inferWeeklyOffersListIntent(query)) return matches;

  const productTokens = catalogProductTokens(query);
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
  if (!areaHint) return null;

  return (
    "Both fresh counter and pre-pack options are on offer this week — ask ONE short clarifying question, for example: " +
    `"Do you mean ${areaHint}?" Do NOT quote any prices or product names until they choose. Then call the tool again with fulfilment set to counter or prepack.`
  );
}

/**
 * Broad offer browse: confirm offers exist, then narrow before reading a random list.
 *
 * This is deliberately category-agnostic. The caller's own words drive the
 * follow-up ("what type are you after?") rather than hardcoded department rules.
 */
export function buildBroadOfferBrowseClarificationHint(
  query: string,
  matches: ClarificationMatch[],
): string | null {
  if (!isBroadProductQuery(query)) return null;
  if (matches.length < 3) return null;

  const labels = distinctProductLabels(matches);
  const departments = new Set(
    matches
      .map((match) => String(match.department ?? "").trim().toLowerCase())
      .filter(Boolean),
  );

  // Two near-identical results are small enough to answer directly. Once the
  // result set is genuinely broad/diverse, make the conversation narrow first.
  if (labels.length < 3 && departments.size < 2) return null;

  return (
    "Matching offers exist, but the caller's request is broad. " +
    "Confirm naturally that there are offers, then ask ONE short narrowing question about what type, category, or brand they are after, using the caller's own words. " +
    "Do NOT list product names or prices yet. Wait for their answer, then search again using that refinement."
  );
}

/** When several types/brands match a broad query, Cara should ask one clarifying question first. */
export function buildBroadProductClarificationHint(
  query: string,
  matches: ClarificationMatch[],
  options?: { allowDepartmentBrowse?: boolean },
): string | null {
  if (inferWeeklyOffersListIntent(query)) return null;
  if (!isBroadProductQuery(query)) return null;
  if (matches.length < 2) return null;

  // If the caller's words match the returned department/category itself,
  // this is a browse request ("cereals", "yogurts", "crisps"), not an
  // ambiguous individual product. Return the category offers directly.
  if (options?.allowDepartmentBrowse !== false && queryMatchesDepartmentScope(query, matches)) {
    return null;
  }

  const labels = distinctProductLabels(matches);
  if (labels.length < 2) return null;

  const productTokens = catalogProductTokens(query);
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
  options?: {
    fulfilment?: SupervaluFulfilment | null;
    intent?: "offer" | "price" | "stock";
  },
): {
  matches: T[];
  clarificationHint: string | null;
  clarificationKind: ProductClarificationKind | null;
} {
  let narrowed = filterOfferMatchesByExplicitFulfilment(
    matches,
    options?.fulfilment,
  );
  if (!queryMatchesDepartmentScope(query, narrowed)) {
    narrowed = narrowMatchesByProductTokens(query, narrowed);
  }
  const fulfilmentHint = buildOfferFulfilmentClarificationHint(
    narrowed,
    options?.fulfilment,
  );
  const refinementHint =
    options?.intent === "offer"
      ? buildBroadOfferBrowseClarificationHint(query, narrowed)
      : buildBroadProductClarificationHint(query, narrowed, {
          // A broad PRICE question usually needs one more detail (type/size/brand)
          // before reading several prices. Stock/range browse can still return a category.
          allowDepartmentBrowse: options?.intent !== "price",
        });
  const clarificationHint = fulfilmentHint ?? refinementHint;
  const clarificationKind: ProductClarificationKind | null = fulfilmentHint
    ? "fulfilment"
    : refinementHint
      ? "refinement"
      : null;
  return {
    clarificationHint,
    clarificationKind,
    matches: narrowed,
  };
}
