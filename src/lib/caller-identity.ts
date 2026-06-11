const UNKNOWN_CALLER = "Unknown caller";

export function isUnknownCallerLabel(name: string): boolean {
  return name.trim().toLowerCase() === UNKNOWN_CALLER.toLowerCase();
}

/** Pick the best display name for a contact/call row. */
export function resolveCallerDisplayName(
  candidates: Array<string | null | undefined>,
  phoneDisplay: string,
): string {
  for (const raw of candidates) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    if (isUnknownCallerLabel(t)) continue;
    return t;
  }
  const phone = phoneDisplay.trim();
  return phone || UNKNOWN_CALLER;
}

export function mergeCallerName(
  existing: string,
  incoming: string | null | undefined,
): string {
  const next = String(incoming ?? "").trim();
  if (!next || isUnknownCallerLabel(next)) return existing;
  if (isUnknownCallerLabel(existing) || !existing.trim()) return next;
  return existing;
}
