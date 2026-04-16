/**
 * Normalise common Irish Eircode shapes (e.g. `F94H002`, `f94 h002`) to
 * `F94 H002` so Nominatim resolves reliably.
 */
export function normalizeIrelandLocationQuery(raw: string): string {
  const q = raw.trim().replace(/\s+/g, " ");
  if (!q) return "";
  const compact = q.replace(/\s/g, "").toUpperCase();
  if (/^[A-Z][0-9]{2}[A-Z0-9]{4}$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }
  return q;
}

/**
 * Geocode a free-text Ireland location (address and/or Eircode) using
 * OpenStreetMap Nominatim. Server-side only; respect Nominatim usage policy.
 */
export async function geocodeIrelandLocation(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = normalizeIrelandLocationQuery(query);
  if (!q) return null;

  // Bare Eircode + ", Ireland" often ranks unrelated "Ireland" POIs in Dublin;
  // `countrycodes=ie` plus a focused query is more reliable.
  const eircodeOnly = /^[A-Z][0-9]{2} [A-Z0-9]{4}$/.test(q);
  const search = eircodeOnly ? q : `${q}, Ireland`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ie");
  url.searchParams.set("q", search);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      // Nominatim requires a valid User-Agent identifying the application.
      "User-Agent": "Cliste/1.0 (Ireland geocoding; https://clistesystems.ie)",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] as { lat?: string; lon?: string };
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
