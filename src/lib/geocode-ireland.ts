/**
 * Normalise common Irish Eircode shapes (e.g. `F94H002`, `f94 h002`) to
 * `F94 H002` so the geocoder resolves reliably.
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

/** Reject geocoder hits outside the island of Ireland (avoids UK / US false matches). */
export function isPlausibleIrelandPoint(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 51.2 && lat <= 55.6 && lng >= -11.0 && lng <= -5.0;
}

export type IrelandGeocodeResult = {
  lat: number;
  lng: number;
  /** Google-normalised formatted address, when available. */
  formattedAddress?: string | null;
};

function serverGoogleKey(): string | null {
  const k =
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    "";
  return k || null;
}

/**
 * Geocode via Google Geocoding API. Scoped to Ireland with `components=country:IE`.
 * Returns null on any non-OK status so callers can fall back.
 */
async function geocodeViaGoogle(
  q: string,
  key: string,
): Promise<IrelandGeocodeResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("region", "ie");
  url.searchParams.set("components", "country:IE");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };
  if (data.status !== "OK") return null;
  for (const r of data.results ?? []) {
    const loc = r.geometry?.location;
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (isPlausibleIrelandPoint(lat, lng)) {
      return {
        lat,
        lng,
        formattedAddress: r.formatted_address?.trim() || null,
      };
    }
  }
  return null;
}

const nominatimHeaders = {
  Accept: "application/json",
  "User-Agent": "Cliste/1.0 (Ireland geocoding; https://clistesystems.ie)",
} as const;

/** Legacy OSM Nominatim fallback used only when no Google key is configured. */
async function geocodeViaNominatim(
  q: string,
): Promise<IrelandGeocodeResult | null> {
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
    const o = row as { lat?: string; lon?: string; display_name?: string };
    const lat = Number(o.lat);
    const lng = Number(o.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (isPlausibleIrelandPoint(lat, lng)) {
      return { lat, lng, formattedAddress: o.display_name ?? null };
    }
  }
  return null;
}

/**
 * Geocode a free-text Ireland location (address and/or Eircode).
 * Prefers Google Geocoding API when `GOOGLE_MAPS_SERVER_API_KEY` (or the
 * public key) is set; falls back to OSM Nominatim otherwise. Server-side only.
 */
export async function geocodeIrelandLocation(
  query: string,
): Promise<IrelandGeocodeResult | null> {
  const q = normalizeIrelandLocationQuery(query);
  if (!q) return null;

  const key = serverGoogleKey();
  if (key) {
    const hit = await geocodeViaGoogle(q, key);
    if (hit) return hit;
  }
  return geocodeViaNominatim(q);
}
