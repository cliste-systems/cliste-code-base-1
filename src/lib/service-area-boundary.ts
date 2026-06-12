/**
 * Service area chip validation, radius semantics, and coverage prompt copy.
 */

import { findNearDuplicateChip, normalizeCaraSetupChip } from "@/lib/cara-setup-chips";
import { resolveCountyName } from "@/lib/irish-counties";

export const SERVICE_AREA_RADIUS_PATTERN =
  /^within\s+(\d{1,3})\s*km$/i;

export const SERVICE_AREA_COVERAGE_INSTRUCTION = `Coverage is defined by county, not every town. Listed town exclusions are never covered even if their county is covered. When a caller mentions a location:
• If it's a listed excluded town or area, I politely say we don't cover there.
• If it's clearly in a covered county and not excluded, I confirm coverage naturally.
• If it's clearly outside the covered counties, I politely say it's beyond the area we cover and offer to take a message.
• If I don't recognise the place or aren't sure which county it's in, I never guess — I ask which town or county they mean, then apply the rules above. If still unsure, I take their details.
"Nationwide" means everywhere in Ireland is covered (still respect any listed town exclusions). A "within X km" entry means within that distance of the business's location.`;

const COMPOUND_SPLIT_PATTERNS: RegExp[] = [
  /\s+and\s+/i,
  /\s+including\s+/i,
  /\s*,\s*/,
];

export function parseRadiusChip(
  text: string,
): { km: number; label: string } | null {
  const match = SERVICE_AREA_RADIUS_PATTERN.exec(normalizeCaraSetupChip(text));
  if (!match) return null;
  const km = Number(match[1]);
  if (!Number.isFinite(km) || km <= 0 || km > 500) return null;
  return { km, label: `Within ${km}km` };
}

export function formatRadiusChip(km: number): string {
  return `Within ${km}km`;
}

export function detectCompoundPlaceChip(text: string): string[] | null {
  const normalized = normalizeCaraSetupChip(text);
  if (!normalized || parseRadiusChip(normalized) || /^nationwide$/i.test(normalized)) {
    return null;
  }

  for (const pattern of COMPOUND_SPLIT_PATTERNS) {
    if (!pattern.test(normalized)) continue;
    const parts = normalized
      .split(pattern)
      .map((part) => normalizeCaraSetupChip(part))
      .filter((part) => part.length >= 2);
    if (parts.length >= 2) return parts;
  }

  return null;
}

export function serviceAreaChipTooLong(text: string): boolean {
  return normalizeCaraSetupChip(text).length > 80;
}

export function findNearDuplicateServiceArea(
  item: string,
  list: string[],
): string | null {
  return findNearDuplicateChip(item, list);
}

/** "Donegal including Letterkenny" → "Donegal" */
export function stripIncludingClause(text: string): string {
  return normalizeCaraSetupChip(text).replace(/\s+including\b.*$/i, "").trim();
}

/** Normalise stored service-area chips for the county editor (legacy town lists). */
export function normalizeServiceAreaCountyItems(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const stripped = stripIncludingClause(raw);
    if (!stripped) continue;

    const county = resolveCountyName(stripped);
    const label = county ?? stripped;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }

  return out;
}

/** Format counties (and optional radius / nationwide) for the compiled prompt. */
export function formatServiceAreaForPrompt(
  items: string[],
  businessLocation?: string,
  townExclusions?: string[],
): string {
  if (items.length === 0) return "";

  const phrases = items.map((item) => {
    const radius = parseRadiusChip(item);
    if (radius) {
      const anchor = businessLocation?.trim() || "the business location";
      return `${radius.label} of ${anchor}`;
    }
    if (/^nationwide$/i.test(item.trim())) {
      return "Nationwide (all of Ireland)";
    }
    return item.trim();
  });

  const counties = phrases.join(", ");
  const exclusions = (townExclusions ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  if (exclusions.length === 0) return counties;

  return `${counties} (excluding ${exclusions.join(", ")})`;
}
