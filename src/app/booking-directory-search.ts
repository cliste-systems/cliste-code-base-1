"use server";

import { createClient } from "@/utils/supabase/server";
import { haversineDistanceKm } from "@/lib/distance-km";
import {
  compactEircode,
  geocodeIrelandLocation,
  isPlausibleIrelandPoint,
  normalizeIrelandLocationQuery,
} from "@/lib/geocode-ireland";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  type OrganizationNiche,
  isOrganizationNiche,
} from "@/lib/organization-niche";

export type PublicDirectoryNicheOption = {
  niche: OrganizationNiche;
  label: string;
};

/** Distinct niches among active organizations (anon RLS). */
export async function listPublicBookingDirectoryNiches(): Promise<
  PublicDirectoryNicheOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("niche")
    .eq("is_active", true);

  if (error) {
    return [];
  }

  const seen = new Set<OrganizationNiche>();
  for (const row of data ?? []) {
    const raw = (row as { niche?: string | null }).niche;
    if (raw && isOrganizationNiche(raw)) {
      seen.add(raw);
    }
  }

  return [...seen]
    .sort()
    .map((niche) => ({
      niche,
      label: ORGANIZATION_NICHE_ADMIN_LABELS[niche],
    }));
}

export type PublicSalonDirectoryRow = {
  slug: string;
  name: string;
  address: string | null;
  /** Set when the search resolved a map point for the visitor */
  distanceKm: number | null;
};

type OrgRow = {
  slug: string;
  name: string;
  address: string | null;
  bio_text: string | null;
  niche: string | null;
  storefront_eircode: string | null;
  storefront_map_lat: number | string | null;
  storefront_map_lng: number | string | null;
};

function tokenize(input: {
  service: string;
  location: string;
  skipLocationTokens: boolean;
  skipServiceTokens: boolean;
}): string[] {
  const servicePart = input.skipServiceTokens ? "" : input.service;
  const raw = input.skipLocationTokens
    ? servicePart
    : [servicePart, input.location].join(" ");
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function haystack(r: {
  name: string;
  address: string | null;
  slug: string;
  bio_text: string | null;
  niche: string;
  storefront_eircode: string | null;
}) {
  return [r.name, r.address, r.slug, r.bio_text, r.niche, r.storefront_eircode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Public directory search (anon RLS: active organizations only).
 * Uses OpenStreetMap Nominatim (same as dashboard) to turn an Eircode or
 * address into coordinates, then sorts by distance. Text tokens still narrow
 * the list when they match; otherwise falls back to all active venues.
 */
export async function searchPublicSalonsDirectory(input: {
  service: string;
  /** When set, results are limited to this organization niche (matches dashboard). */
  serviceNiche?: OrganizationNiche | null;
  location: string;
  date: string;
  viewerLat?: number | null;
  viewerLng?: number | null;
}): Promise<
  | { ok: true; salons: PublicSalonDirectoryRow[] }
  | { ok: false; message: string }
> {
  void input.date;

  const hasViewerPoint =
    typeof input.viewerLat === "number" &&
    typeof input.viewerLng === "number" &&
    Number.isFinite(input.viewerLat) &&
    Number.isFinite(input.viewerLng);

  const locationTrim = input.location.trim();
  const skipLocationTokens =
    hasViewerPoint &&
    (locationTrim === "" ||
      /^(near you|current location)$/i.test(locationTrim));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "slug, name, address, bio_text, niche, storefront_eircode, storefront_map_lat, storefront_map_lng",
    )
    .eq("is_active", true)
    .order("name");

  if (error) {
    return { ok: false, message: error.message };
  }

  const normalized = (data ?? [])
    .filter((r) => Boolean(r.slug?.trim()) && Boolean(r.name?.trim()))
    .map((r) => {
      const row = r as OrgRow;
      const lat = Number(row.storefront_map_lat);
      const lng = Number(row.storefront_map_lng);
      const mapLat = Number.isFinite(lat) ? lat : null;
      const mapLng = Number.isFinite(lng) ? lng : null;
      const pinOk =
        mapLat !== null &&
        mapLng !== null &&
        isPlausibleIrelandPoint(mapLat, mapLng);
      const nicheRaw = (row.niche ?? "").trim();
      const niche = isOrganizationNiche(nicheRaw) ? nicheRaw : "hair_salon";
      return {
        slug: String(row.slug).trim(),
        name: String(row.name).trim(),
        address: row.address?.trim() ?? null,
        bio_text: row.bio_text?.trim() ?? null,
        niche,
        storefront_eircode: row.storefront_eircode?.trim() ?? null,
        mapLat: pinOk ? mapLat : null,
        mapLng: pinOk ? mapLng : null,
      };
    });

  const serviceNiche =
    input.serviceNiche && isOrganizationNiche(input.serviceNiche)
      ? input.serviceNiche
      : null;
  const pool =
    serviceNiche !== null
      ? normalized.filter((r) => r.niche === serviceNiche)
      : normalized;

  const tokens = tokenize({
    service: input.service,
    location: input.location,
    skipLocationTokens,
    skipServiceTokens: serviceNiche !== null,
  });

  let userPoint: { lat: number; lng: number } | null = null;
  if (hasViewerPoint) {
    const lat = input.viewerLat!;
    const lng = input.viewerLng!;
    if (isPlausibleIrelandPoint(lat, lng)) {
      userPoint = { lat, lng };
    }
  } else if (locationTrim) {
    const g = await geocodeIrelandLocation(
      normalizeIrelandLocationQuery(locationTrim),
    );
    if (g && isPlausibleIrelandPoint(g.lat, g.lng)) {
      userPoint = g;
    }
  }

  const visitorEir = compactEircode(normalizeIrelandLocationQuery(locationTrim));

  const pickRows = () => {
    if (tokens.length === 0) {
      return pool;
    }
    const strict = pool.filter((r) =>
      tokens.every((t) => haystack(r).includes(t)),
    );
    return strict.length > 0 ? strict : pool;
  };

  const picked = pickRows();

  const withDistance = picked.map((r) => {
    let distanceKm: number | null = null;
    const salonEir = compactEircode(r.storefront_eircode);
    if (visitorEir && salonEir && visitorEir === salonEir) {
      distanceKm = 0;
    } else if (userPoint && r.mapLat !== null && r.mapLng !== null) {
      distanceKm = haversineDistanceKm(
        userPoint.lat,
        userPoint.lng,
        r.mapLat,
        r.mapLng,
      );
    }
    return { ...r, distanceKm };
  });

  if (userPoint || visitorEir) {
    withDistance.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  return {
    ok: true,
    salons: withDistance.map(({ slug, name, address, distanceKm }) => ({
      slug,
      name,
      address,
      distanceKm,
    })),
  };
}
