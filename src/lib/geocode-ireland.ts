/**
 * Geocode a free-text Ireland location (address and/or Eircode) using
 * OpenStreetMap Nominatim. Server-side only; respect Nominatim usage policy.
 */
export async function geocodeIrelandLocation(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (!q) return null;

  const search = `${q}, Ireland`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", search);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      // Nominatim requires a valid User-Agent identifying the application.
      "User-Agent": "ClisteDashboard/1.0 (storefront geocoding)",
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
