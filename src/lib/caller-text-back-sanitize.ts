const EM_DASH_RE = /\s*[—–]\s*/g;
const MULTISPACE_RE = /\s{2,}/g;

/** Strip em/en dashes and tidy spacing — safe client-side fallback. */
export function heuristicSanitizeCallerTextBackMiddle(text: string): string {
  let value = text.trim();
  if (!value) return "";

  value = value
    .replace(EM_DASH_RE, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ", ")
    .replace(MULTISPACE_RE, " ")
    .trim();

  if (value.endsWith(",")) {
    value = `${value.slice(0, -1).trim()}.`;
  }

  return capitalizeFirst(value);
}

/** Final guard before send — never allow em dashes in customer SMS. */
export function finalizeCallerTextBackMiddle(text: string): string {
  return heuristicSanitizeCallerTextBackMiddle(text.replace(EM_DASH_RE, ", "));
}

function capitalizeFirst(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseCallerTextBackReviewJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown; middle?: unknown };
    const candidate =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.middle === "string"
          ? parsed.middle
          : "";
    const cleaned = finalizeCallerTextBackMiddle(candidate);
    return cleaned || null;
  } catch {
    const cleaned = finalizeCallerTextBackMiddle(trimmed);
    return cleaned || null;
  }
}
