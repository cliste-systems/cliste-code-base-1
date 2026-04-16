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

/** Seven-character Eircode key for equality checks (e.g. `F94H002`). */
export function compactEircode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.replace(/\s/g, "").toUpperCase();
  return /^[A-Z][0-9]{2}[A-Z0-9]{4}$/.test(c) ? c : null;
}

/** Reject Nominatim hits outside the island of Ireland (avoids UK / US false matches). */
export function isPlausibleIrelandPoint(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 51.2 && lat <= 55.6 && lng >= -11.0 && lng <= -5.0;
}

const nominatimHeaders = {
  Accept: "application/json",
  "User-Agent": "Cliste/1.0 (Ireland geocoding; https://clistesystems.ie)",
} as const;

/**
 * Geocode a free-text Ireland location (address and/or Eircode) using
 * OpenStreetMap Nominatim. Server-side only; respect Nominatim usage policy.
 */
export async function geocodeIrelandLocation(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = normalizeIrelandLocationQuery(query);
  if (!q) return null;

  const eircodeOnly = /^[A-Z][0-9]{2} [A-Z0-9]{4}$/.test(q);
  const search = eircodeOnly ? q : `${q}, Ireland`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", eircodeOnly ? "8" : "1");
  url.searchParams.set("countrycodes", "ie");
  url.searchParams.set("q", search);

  const res = await fetch(url.toString(), {
    headers: nominatimHeaders,
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;

  for (const row of data) {
    const o = row as { lat?: string; lon?: string };
    const lat = Number(o.lat);
    const lng = Number(o.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (isPlausibleIrelandPoint(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}
