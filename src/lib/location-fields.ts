/** Structured salon location — maps to organizations agent_location_* columns. */

export type ParsedLocationFields = {
  street: string;
  town: string;
  county: string;
};

export function parseStoredLocation(input: {
  address?: string | null;
  baseTown?: string | null;
  county?: string | null;
}): ParsedLocationFields {
  const streetRaw = (input.address ?? "").trim();
  const town = (input.baseTown ?? "").trim();
  const county = (input.county ?? "").trim();

  if (town || county) {
    return { street: streetRaw, town, county };
  }

  if (streetRaw.includes(",")) {
    const parts = streetRaw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      return {
        street: parts[0] ?? "",
        town: parts.slice(1, -1).join(", "),
        county: parts[parts.length - 1] ?? "",
      };
    }
    if (parts.length === 2) {
      return { street: parts[0] ?? "", town: parts[1] ?? "", county: "" };
    }
  }

  return { street: streetRaw, town: "", county: "" };
}

/** Single line for Cara prompt and owner preview — street, town, county, Eircode. */
export function formatLocationPhrase(
  fields: ParsedLocationFields,
  eircode?: string,
): string | null {
  const parts = [
    fields.street.trim(),
    fields.town.trim(),
    fields.county.trim(),
    eircode?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
