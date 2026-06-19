/** Irish Eircode: routing key (letter + 2 digits) + unique identifier (4 alphanumeric). */
const EIRCODE_PATTERN = /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/;

const EIRCODE_FIND_RE = /\b([A-Z]\d{2})\s?([A-Z0-9]{4})\b/gi;

/** Normalize to `A65 F4E2` form, or null if invalid / multiple codes in one string. */
export function normalizeEircode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed || trimmed.includes(",")) return null;

  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length !== 7) return null;

  const normalized = `${compact.slice(0, 3)} ${compact.slice(3)}`;
  return EIRCODE_PATTERN.test(normalized) ? normalized : null;
}

export function isValidIrishEircode(raw: string): boolean {
  return normalizeEircode(raw) !== null;
}

/** Distinct valid eircodes found in free text, in document order. */
export function extractIrishEircodes(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of text.matchAll(EIRCODE_FIND_RE)) {
    const normalized = normalizeEircode(`${match[1] ?? ""} ${match[2] ?? ""}`);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}
