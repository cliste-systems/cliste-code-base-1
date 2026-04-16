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

function firstHttpsFromGallery(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const u of raw) {
    if (typeof u !== "string") continue;
    const t = u.trim();
    if (/^https?:\/\//i.test(t)) return t;
  }
  return null;
}

function normalizePublicLogoUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || /^data:image\//i.test(t)) return t;
  return null;
}

function bioSnippet(raw: string | null, maxLen: number): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

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
  niche: OrganizationNiche;
  nicheLabel: string;
  bioSnippet: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  ratingLine: string | null;
};

type OrgRow = {
  slug: string;
  name: string;
  address: string | null;
  bio_text: string | null;
  niche: string | null;
  logo_url: string | null;
  storefront_eircode: string | null;
  storefront_gallery_urls: unknown;
  storefront_rating_text: string | null;
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

/** Venues farther than this from a resolved “where” point are excluded (county / city search). */
const DIRECTORY_LOCATION_RADIUS_KM = 100;

/**
 * Public directory search (anon RLS: active organizations only).
 * Geocoded or GPS locations filter by distance; text tokens filter when no
 * map point. There is no “show everything” fallback when the visitor asked
 * for a specific place that does not match.
 */
export async function searchPublicSalonsDirectory(input: {
  service: string;
  /** When set, results are limited to this organization niche (matches dashboard). */
  serviceNiche?: OrganizationNiche | null;
  location: string;
  viewerLat?: number | null;
  viewerLng?: number | null;
}): Promise<
  | { ok: true; salons: PublicSalonDirectoryRow[] }
  | { ok: false; message: string }
> {
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
      "slug, name, address, bio_text, niche, logo_url, storefront_eircode, storefront_gallery_urls, storefront_rating_text, storefront_map_lat, storefront_map_lng",
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
      const niche: OrganizationNiche = isOrganizationNiche(nicheRaw)
        ? nicheRaw
        : "hair_salon";
      return {
        slug: String(row.slug).trim(),
        name: String(row.name).trim(),
        address: row.address?.trim() ?? null,
        bio_text: row.bio_text?.trim() ?? null,
        niche,
        logoUrl: normalizePublicLogoUrl(row.logo_url),
        coverImageUrl: firstHttpsFromGallery(row.storefront_gallery_urls),
        ratingLine: row.storefront_rating_text?.trim() || null,
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
    if (userPoint) {
      return pool.filter((r) => {
        const salonEir = compactEircode(r.storefront_eircode);
        if (visitorEir && salonEir && visitorEir === salonEir) {
          return true;
        }
        if (r.mapLat === null || r.mapLng === null) {
          return false;
        }
        const d = haversineDistanceKm(
          userPoint.lat,
          userPoint.lng,
          r.mapLat,
          r.mapLng,
        );
        return d <= DIRECTORY_LOCATION_RADIUS_KM;
      });
    }

    if (visitorEir) {
      return pool.filter((r) => {
        const salonEir = compactEircode(r.storefront_eircode);
        return salonEir === visitorEir;
      });
    }

    if (tokens.length === 0) {
      return pool;
    }

    return pool.filter((r) => tokens.every((t) => haystack(r).includes(t)));
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
    salons: withDistance.map((r) => ({
      slug: r.slug,
      name: r.name,
      address: r.address,
      distanceKm: r.distanceKm,
      niche: r.niche,
      nicheLabel: ORGANIZATION_NICHE_ADMIN_LABELS[r.niche],
      bioSnippet: bioSnippet(r.bio_text, 160),
      logoUrl: r.logoUrl,
      coverImageUrl: r.coverImageUrl,
      ratingLine: r.ratingLine,
    })),
  };
}
