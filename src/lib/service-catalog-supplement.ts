import {
  formatAgentKnowledgeList,
  parseAgentKnowledgeList,
} from "@/lib/agent-knowledge-format";
import {
  dedupeCaraSetupChips,
  findExactChipInList,
  findNearDuplicateChip,
} from "@/lib/cara-setup-chips";

export type ServiceCatalogSupplement = {
  supplementalServices: string[];
  generalNotes: string;
};

export const MAX_SUPPLEMENT_SERVICES = 10;
export const MAX_GENERAL_NOTES_LENGTH = 500;

export function emptyServiceCatalogSupplement(): ServiceCatalogSupplement {
  return { supplementalServices: [], generalNotes: "" };
}

export function isCatalogDuplicate(
  item: string,
  catalogNames: string[],
): boolean {
  const trimmed = item.trim();
  if (!trimmed) return false;
  return Boolean(
    findExactChipInList(trimmed, catalogNames) ||
      findNearDuplicateChip(trimmed, catalogNames),
  );
}

export function filterSupplementAgainstCatalog(
  supplement: ServiceCatalogSupplement,
  catalogNames: string[],
): ServiceCatalogSupplement {
  const supplementalServices = dedupeCaraSetupChips(supplement.supplementalServices)
    .filter((item) => !isCatalogDuplicate(item, catalogNames))
    .slice(0, MAX_SUPPLEMENT_SERVICES);

  const generalNotes = supplement.generalNotes.trim().slice(0, MAX_GENERAL_NOTES_LENGTH);

  return {
    supplementalServices,
    generalNotes,
  };
}

export function hasServiceCatalogSupplement(
  supplement: ServiceCatalogSupplement | null | undefined,
): boolean {
  if (!supplement) return false;
  return (
    supplement.supplementalServices.length > 0 ||
    Boolean(supplement.generalNotes.trim())
  );
}

export function parseStoredServiceCatalogSupplement(
  raw: unknown,
): ServiceCatalogSupplement | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const services = Array.isArray(record.supplementalServices)
    ? record.supplementalServices
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];
  const generalNotes = String(record.generalNotes ?? "").trim();
  if (services.length === 0 && !generalNotes) return null;
  return filterSupplementAgainstCatalog(
    { supplementalServices: services, generalNotes },
    [],
  );
}

export function serializeServiceCatalogSupplement(
  supplement: ServiceCatalogSupplement,
): Record<string, unknown> | null {
  const filtered = filterSupplementAgainstCatalog(supplement, []);
  if (!hasServiceCatalogSupplement(filtered)) return null;
  return {
    supplementalServices: filtered.supplementalServices,
    generalNotes: filtered.generalNotes,
  };
}

export function formatSupplementalServicesList(services: string[]): string {
  return formatAgentKnowledgeList(services);
}

/**
 * Fallback when LLM is unavailable: pull comma/newline chips, drop catalog dupes,
 * keep remaining prose as general notes.
 */
export function fallbackServiceCatalogSupplement(
  raw: string,
  catalogNames: string[],
): ServiceCatalogSupplement {
  const trimmed = raw.trim();
  if (!trimmed) return emptyServiceCatalogSupplement();

  const candidates = parseAgentKnowledgeList(trimmed)
    .map((line) =>
      line
        .trim()
        .replace(/^we\s+(also\s+)?(do|offer|provide|take)\s+/i, "")
        .replace(/[.!?,;:]+$/g, "")
        .trim(),
    )
    .filter(Boolean);

  const supplementalServices: string[] = [];
  const noteParts: string[] = [];

  for (const candidate of candidates) {
    const sentences = candidate
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const sentence of sentences.length > 0 ? sentences : [candidate]) {
      if (isCatalogDuplicate(sentence, catalogNames)) continue;
      const looksLikePolicy =
        sentence.length > 48 ||
        /\b(required|must|needs?|policy|only|before|first)\b/i.test(sentence);
      if (!looksLikePolicy) {
        supplementalServices.push(
          sentence.replace(/[.!?,;:]+$/g, "").trim(),
        );
      } else {
        noteParts.push(sentence);
      }
    }
  }

  const usedLines = new Set(
    [...supplementalServices, ...noteParts].map((part) => part.toLowerCase()),
  );
  const leftover = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !usedLines.has(line.toLowerCase()));

  const generalNotes = [...noteParts, ...leftover].join(" ").trim();

  return filterSupplementAgainstCatalog(
    {
      supplementalServices: dedupeCaraSetupChips(supplementalServices),
      generalNotes,
    },
    catalogNames,
  );
}
