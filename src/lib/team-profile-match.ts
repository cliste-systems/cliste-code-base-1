/** Normalize for case-insensitive name comparison */
function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Map a Services & team showcase label (e.g. "Mary") to a `profiles.id` when
 * the salon lists staff on the public page.
 */
export function matchStorefrontNameToProfileId(
  teamName: string,
  profiles: { id: string; name: string | null }[],
): string | null {
  const t = normalizeName(teamName);
  if (!t) return null;

  const exact = profiles.find((p) => normalizeName(p.name ?? "") === t);
  if (exact) return exact.id;

  const relaxed = profiles.find((p) => {
    const n = normalizeName(p.name ?? "");
    if (!n) return false;
    if (n.startsWith(t + " ")) return true;
    const first = n.split(/\s+/)[0];
    return first === t;
  });
  return relaxed?.id ?? null;
}
