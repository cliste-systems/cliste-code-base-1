import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  findExactChipInList,
  findNearDuplicateChip,
} from "@/lib/cara-setup-chips";

function normalizeListKey(text: string): string {
  return parseAgentKnowledgeList(text)
    .map((item) => item.toLowerCase())
    .sort()
    .join("\n");
}

/**
 * Detect when plain-English raw text is really a duplicated service catalog list
 * (common when chip fields were mistaken for owner prose).
 */
export function looksLikeCatalogListDump(
  raw: string,
  catalogNames: string[],
  offeredChips?: string,
): boolean {
  const rawTrim = raw.trim();
  if (!rawTrim || catalogNames.length === 0) return false;

  if (offeredChips?.trim()) {
    if (normalizeListKey(rawTrim) === normalizeListKey(offeredChips)) {
      return true;
    }
  }

  const catalogSet = new Set(
    catalogNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const rawLines = parseAgentKnowledgeList(rawTrim);
  if (rawLines.length < 2) return false;

  const exactMatches = rawLines.filter((line) =>
    catalogSet.has(line.toLowerCase()),
  );
  if (exactMatches.length / rawLines.length >= 0.6) return true;

  const fuzzyMatches = rawLines.filter((line) => {
    const lower = line.toLowerCase();
    return [...catalogSet].some(
      (catalog) => catalog.includes(lower) || lower.includes(catalog),
    );
  });
  return rawLines.length >= 3 && fuzzyMatches.length / rawLines.length >= 0.75;
}

export function sanitizeServicesOfferedRaw(input: {
  raw: string;
  catalogNames: string[];
  offeredChips?: string;
}): string {
  const raw = input.raw.trim();
  if (!raw) return "";
  if (input.catalogNames.length === 0) return raw;
  return looksLikeCatalogListDump(raw, input.catalogNames, input.offeredChips)
    ? ""
    : raw;
}

/** Soft hints for lines in own-words that duplicate imported menu items. */
export function findCatalogDuplicateLineHints(
  raw: string,
  catalogNames: string[],
): string[] {
  const trimmed = raw.trim();
  if (!trimmed || catalogNames.length === 0) return [];

  const hints: string[] = [];
  const seen = new Set<string>();

  for (const line of parseAgentKnowledgeList(trimmed)) {
    const exact = findExactChipInList(line, catalogNames);
    const near = exact ?? findNearDuplicateChip(line, catalogNames);
    if (!near) continue;
    const key = near.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hints.push(near);
  }

  return hints;
}
