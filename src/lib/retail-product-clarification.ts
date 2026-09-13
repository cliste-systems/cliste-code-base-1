import {
  stripCatalogPackagingNoise,
  stripCatalogSearchBoilerplate,
} from "@/lib/supervalu-catalog-search";
import {
  inferWeeklyOffersListIntent,
  tokenizeSupervaluSearchQuery,
} from "@/lib/retail-weekly-offers-search";

export type ClarificationMatch = {
  productName?: string;
  product_name?: string;
};

/** Caller named a category, not a specific brand/type/size. */
export function isBroadProductQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (inferWeeklyOffersListIntent(trimmed)) return false;

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

/** When several types/brands match a broad query, Cara should ask one clarifying question first. */
export function buildBroadProductClarificationHint(
  query: string,
  matches: ClarificationMatch[],
): string | null {
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
