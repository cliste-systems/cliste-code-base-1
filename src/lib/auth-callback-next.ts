/** Validate safe internal redirect targets from auth callback ?next= */
export function resolveSafeAuthNextPath(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (value.includes("://")) return null;
  return value;
}
