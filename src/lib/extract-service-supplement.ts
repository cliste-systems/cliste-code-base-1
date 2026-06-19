import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import {
  fallbackServiceCatalogSupplement,
  filterSupplementAgainstCatalog,
  MAX_GENERAL_NOTES_LENGTH,
  MAX_SUPPLEMENT_SERVICES,
  type ServiceCatalogSupplement,
} from "@/lib/service-catalog-supplement";

const MAX_RAW_LENGTH = 1500;

function parseSupplementJson(raw: string): ServiceCatalogSupplement | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const json = JSON.parse(trimmed.slice(start, end + 1)) as {
      supplementalServices?: unknown;
      generalNotes?: unknown;
    };
    const supplementalServices = Array.isArray(json.supplementalServices)
      ? json.supplementalServices
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .slice(0, MAX_SUPPLEMENT_SERVICES)
      : [];
    const generalNotes = String(json.generalNotes ?? "")
      .trim()
      .slice(0, MAX_GENERAL_NOTES_LENGTH);
    return { supplementalServices, generalNotes };
  } catch {
    return null;
  }
}

export async function extractServiceCatalogSupplement(
  rawParagraph: string,
  catalogNames: string[],
): Promise<ServiceCatalogSupplement> {
  const raw = rawParagraph.trim().slice(0, MAX_RAW_LENGTH);
  if (!raw || catalogNames.length === 0) {
    return { supplementalServices: [], generalNotes: "" };
  }

  const menuSample = catalogNames.slice(0, 40).join("\n");

  try {
    const response = await completeOpenRouterChat({
      temperature: 0.1,
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content: `You extract ONLY information from salon owner text that is NOT already covered by their imported service menu.
Return JSON only: {"supplementalServices":["short phrase",...],"generalNotes":"..."}
Rules:
- supplementalServices: short noun phrases for services/treatments explicitly offered but missing from the menu list. Max ${MAX_SUPPLEMENT_SERVICES}.
- generalNotes: brief policies or qualifiers about services (patch tests, booking rules, off-menu packages). Max ${MAX_GENERAL_NOTES_LENGTH} chars. Empty string if none.
- Exclude anything that duplicates or near-duplicates a menu item name.
- Never invent services or policies.
- If the text only repeats the menu, return {"supplementalServices":[],"generalNotes":""}.`,
        },
        {
          role: "user",
          content: `Menu already imported:\n${menuSample}\n\nOwner supplement text:\n${raw}`,
        },
      ],
    });

    const parsed = parseSupplementJson(response);
    if (parsed) {
      return filterSupplementAgainstCatalog(parsed, catalogNames);
    }
  } catch {
    // fall through to deterministic fallback
  }

  return fallbackServiceCatalogSupplement(raw, catalogNames);
}
