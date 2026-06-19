import { extractIrishEircodes, normalizeEircode } from "@/lib/irish-eircode";
import type {
  WebsiteImportFaq,
  WebsiteImportLocation,
} from "@/lib/website-import-types";

function isComingSoonLocation(location: WebsiteImportLocation): boolean {
  const blob = `${location.label} ${location.address}`.toLowerCase();
  return blob.includes("coming soon");
}

export function asImportLocation(entry: unknown): WebsiteImportLocation | null {
  if (typeof entry !== "object" || entry === null) return null;
  const rec = entry as Record<string, unknown>;
  const label = String(rec.label ?? "").trim().slice(0, 120);
  const address = String(rec.address ?? "").trim().slice(0, 200);
  const eircode = normalizeEircode(String(rec.eircode ?? "")) ?? "";
  const phone = String(rec.phone ?? "").trim().slice(0, 40) || undefined;
  const email = String(rec.email ?? "").trim().slice(0, 120) || undefined;

  if (!address && !label && !eircode) return null;
  const location: WebsiteImportLocation = { label, address, eircode, phone, email };
  if (isComingSoonLocation(location)) return null;
  return location;
}

export function asLocations(value: unknown, max = 8): WebsiteImportLocation[] {
  if (!Array.isArray(value)) return [];
  const out: WebsiteImportLocation[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const location = asImportLocation(entry);
    if (!location) continue;
    const key =
      location.eircode || `${location.label}|${location.address}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(location);
    if (out.length >= max) break;
  }

  return out;
}

/** Best-effort parse of multiple branches from contact-page style text. */
export function extractLocationsFromPageText(
  text: string,
): WebsiteImportLocation[] {
  const pattern = /\b([A-Z]\d{2})\s?([A-Z0-9]{4})\b/gi;
  const matches = [...text.matchAll(pattern)];
  const hits: { eircode: string; index: number }[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const eircode = normalizeEircode(`${match[1] ?? ""} ${match[2] ?? ""}`);
    if (!eircode || seen.has(eircode)) continue;
    seen.add(eircode);
    hits.push({ eircode, index: match.index ?? 0 });
  }

  if (hits.length < 2) return [];

  return hits
    .map(({ eircode, index }, i) => {
      const prevEnd = i === 0 ? 0 : hits[i - 1]!.index + 10;
      const start = Math.max(0, Math.min(prevEnd, index - 200));
      const chunk = text.slice(start, index + eircode.length);

      const labelMatches = [...chunk.matchAll(/\(([^)]+)\)/g)];
      const label = labelMatches.at(-1)?.[1]?.trim().slice(0, 120) ?? "";

      const address = chunk
        .replace(/Email:\s*\S+@\S+/gi, "")
        .replace(/Tel:\s*[\d\s]+/gi, "")
        .replace(/\([^)]+\)/g, " ")
        .replace(new RegExp(eircode.replace(" ", "\\s?"), "i"), "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);

      const phoneMatch = chunk.match(/Tel:\s*([\d\s]+)/i);
      const emailMatch = chunk.match(/Email:\s*(\S+@\S+)/i);

      const location: WebsiteImportLocation = {
        label,
        address,
        eircode,
        phone: phoneMatch?.[1]?.trim().slice(0, 40),
        email: emailMatch?.[1]?.trim().slice(0, 120),
      };

      return isComingSoonLocation(location) ? null : location;
    })
    .filter((location): location is WebsiteImportLocation => Boolean(location));
}

export function buildMultiLocationFaq(
  locations: WebsiteImportLocation[],
): WebsiteImportFaq {
  const answer = locations
    .map((loc) => {
      const parts = [
        loc.label,
        loc.address,
        loc.eircode,
        loc.phone ? `Tel: ${loc.phone}` : "",
      ].filter(Boolean);
      return parts.join(" — ");
    })
    .join(". ");

  return {
    question: "Where are you located?",
    answer: answer.slice(0, 800),
  };
}

export function mergeMultiLocationFaq(
  faqs: WebsiteImportFaq[],
  locations: WebsiteImportLocation[],
): WebsiteImportFaq[] {
  if (locations.length < 2) return faqs;

  const hasLocationFaq = faqs.some((faq) =>
    /\b(where are you|locations?|address|find you)\b/i.test(faq.question),
  );
  if (hasLocationFaq) return faqs;

  return [...faqs, buildMultiLocationFaq(locations)].slice(0, 7);
}

export function finalizeImportLocations(input: {
  aiLocations: WebsiteImportLocation[];
  flatAddress: string;
  flatEircode: string;
  pageText: string;
}): { locations: WebsiteImportLocation[]; address: string; eircode: string } {
  let locations = input.aiLocations.filter((loc) => !isComingSoonLocation(loc));

  const flatEircode = normalizeEircode(input.flatEircode);
  const mergedCodes = extractIrishEircodes(input.flatEircode);

  if (locations.length < 2 && mergedCodes.length >= 2) {
    locations = extractLocationsFromPageText(input.pageText);
  }

  if (locations.length < 2 && extractIrishEircodes(input.pageText).length >= 2) {
    const heuristic = extractLocationsFromPageText(input.pageText);
    if (heuristic.length >= 2) locations = heuristic;
  }

  if (locations.length === 0 && (input.flatAddress || flatEircode)) {
    locations = [
      {
        label: "",
        address: input.flatAddress,
        eircode: flatEircode ?? "",
      },
    ];
  }

  if (locations.length === 1) {
    const only = locations[0]!;
    return {
      locations,
      address: only.address || input.flatAddress,
      eircode: only.eircode || flatEircode || "",
    };
  }

  if (locations.length > 1) {
    return { locations, address: "", eircode: "" };
  }

  return {
    locations: [],
    address: input.flatAddress,
    eircode: flatEircode ?? "",
  };
}
