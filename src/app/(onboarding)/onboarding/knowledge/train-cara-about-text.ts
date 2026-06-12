const STRUCTURED_LINE =
  /^(Services|Opening hours|Areas covered|Emergency|Pricing|Walk-ins|Typical caller needs)\s*:/i;

/** Detects the old multi-field know form serialized into one blob. */
export function isLegacyStructuredAbout(text: string): boolean {
  return text
    .split("\n")
    .some((line) => STRUCTURED_LINE.test(line.trim()));
}

/** About step shows saved prose only — never legacy structured blobs or profile openers. */
export function aboutTextForStep(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed || isLegacyStructuredAbout(trimmed)) return "";
  return trimmed;
}

