const MAX_BASE_TOWN_LENGTH = 80;

export function normalizeBaseTown(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_BASE_TOWN_LENGTH);
}

export function serviceAreaAnchorTown(
  baseTown?: string,
  locationAddress?: string,
): string | undefined {
  const town = normalizeBaseTown(baseTown ?? "");
  if (town) return town;

  const address = locationAddress?.trim();
  if (!address) return undefined;

  // Fall back to the last segment of a comma-separated address (often the town).
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[parts.length - 1];
}
