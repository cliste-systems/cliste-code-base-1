"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { geocodeIrelandLocation } from "@/lib/geocode-ireland";
import { isMissingStorefrontSchemaError } from "@/lib/organization-storefront-query";
import {
  parseStorefrontAmenityLabels,
  type StorefrontReviewsBlock,
} from "@/lib/storefront-blocks";
import { uploadSalonImageFromDataUrl } from "@/lib/salon-image-upload";
import {
  normalizeFacebookHandleForStorage,
  normalizeInstagramHandleForStorage,
} from "@/lib/social-handles";

async function persistSalonLogo(
  organizationId: string,
  dataUrl: string,
): Promise<string> {
  return uploadSalonImageFromDataUrl(organizationId, dataUrl, "logo");
}

async function resolveStorefrontGalleryUrls(
  organizationId: string,
  urls: string[],
): Promise<string[]> {
  const out: string[] = [];
  for (const raw of urls.slice(0, 3)) {
    const u = raw.trim();
    if (!u) continue;
    if (u.startsWith("data:")) {
      out.push(await uploadSalonImageFromDataUrl(organizationId, u, "gallery"));
    } else if (/^https?:\/\//i.test(u)) {
      out.push(u);
    }
  }
  return out;
}

export type StorefrontSavePayload = {
  name: string;
  address: string;
  bioText: string;
  freshaUrl: string;
  /** Omit to leave existing social handles unchanged. */
  instagramUrl?: string;
  /** Omit to leave existing social handles unchanged. */
  facebookUrl?: string;
  /** New logo as a data URL from the browser file reader. */
  logoDataUrl?: string | null;
  /** When true, clears `logo_url` in the database. */
  clearLogo?: boolean;
  /** Up to 3 image URLs: existing https URLs and/or new data URLs (uploaded on save). */
  storefrontGallery?: string[];
  /** Optional rating/reviews line for the public booking page. */
  storefrontRatingText?: string;
  /** Irish Eircode; used with address for map pin geocoding. */
  storefrontEircode?: string;
  /** Amenity labels (max 20) shown under the bio on the public page. */
  storefrontAmenities?: string[];
  /** Reviews card: aggregate score line + quote entries. */
  storefrontReviewsBlock?: StorefrontReviewsBlock | null;
  storefrontShowTeam?: boolean;
  storefrontShowMap?: boolean;
  storefrontShowReviews?: boolean;
};

function normalizeAmenitiesForSave(raw: string[] | undefined): unknown[] {
  if (!raw) return [];
  const parsed = parseStorefrontAmenityLabels(raw);
  return parsed;
}

function normalizeReviewsForSave(
  raw: StorefrontReviewsBlock | null | undefined,
): unknown | null {
  if (raw == null) return null;
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const cleaned: StorefrontReviewsBlock = {};
  if (typeof raw.score === "string" && raw.score.trim()) {
    cleaned.score = raw.score.trim().slice(0, 12);
  }
  cleaned.entries = [];
  for (const e of entries) {
    if (!e?.name?.trim() || !e?.body?.trim()) continue;
    cleaned.entries!.push({
      name: e.name.trim().slice(0, 80),
      body: e.body.trim().slice(0, 600),
      ...(e.relativeTime?.trim()
        ? { relativeTime: e.relativeTime.trim().slice(0, 40) }
        : {}),
    });
    if (cleaned.entries!.length >= 8) break;
  }
  if (!cleaned.score && (!cleaned.entries || cleaned.entries.length === 0)) {
    return null;
  }
  return cleaned;
}

export async function saveStorefront(
  payload: StorefrontSavePayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: tierRow, error: tierError } = await supabase
    .from("organizations")
    .select("tier")
    .eq("id", organizationId)
    .single();

  if (tierError || !tierRow) {
    return {
      ok: false,
      message: tierError?.message ?? "Could not load organization tier.",
    };
  }

  const isConnect = tierRow.tier === "connect";
  const freshaUrl = isConnect ? payload.freshaUrl.trim() || null : null;

  const instagramHandle =
    payload.instagramUrl !== undefined
      ? normalizeInstagramHandleForStorage(payload.instagramUrl)
      : undefined;
  const facebookHandle =
    payload.facebookUrl !== undefined
      ? normalizeFacebookHandleForStorage(payload.facebookUrl)
      : undefined;

  let logoUrl: string | null | undefined;
  if (payload.clearLogo) {
    logoUrl = null;
  } else if (
    typeof payload.logoDataUrl === "string" &&
    payload.logoDataUrl.startsWith("data:")
  ) {
    try {
      logoUrl = await persistSalonLogo(organizationId, payload.logoDataUrl);
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error ? e.message : "Could not save the salon logo.",
      };
    }
  }

  let resolvedGallery: string[] | undefined;
  if (payload.storefrontGallery !== undefined) {
    try {
      resolvedGallery = await resolveStorefrontGalleryUrls(
        organizationId,
        payload.storefrontGallery,
      );
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error
            ? e.message
            : "Could not save gallery images.",
      };
    }
  }

  const trimmedName = payload.name.trim();
  const addressTrim = payload.address.trim();
  const eircodeTrim = (payload.storefrontEircode ?? "").trim();

  let mapLat: number | null = null;
  let mapLng: number | null = null;
  const geoQuery = [addressTrim, eircodeTrim].filter(Boolean).join(", ");
  if (geoQuery) {
    const g = await geocodeIrelandLocation(geoQuery);
    if (g) {
      mapLat = g.lat;
      mapLng = g.lng;
    }
  }

  const orgUpdate: Record<string, unknown> = {
    address: addressTrim || null,
    bio_text: payload.bioText.trim() || null,
    fresha_url: freshaUrl,
    ...(instagramHandle !== undefined ? { instagram_url: instagramHandle } : {}),
    ...(facebookHandle !== undefined ? { facebook_url: facebookHandle } : {}),
    ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
    ...(resolvedGallery !== undefined
      ? { storefront_gallery_urls: resolvedGallery }
      : {}),
    ...(payload.storefrontRatingText !== undefined
      ? {
          storefront_rating_text:
            payload.storefrontRatingText.trim() || null,
        }
      : {}),
    storefront_eircode: eircodeTrim || null,
    storefront_map_lat: mapLat,
    storefront_map_lng: mapLng,
    storefront_amenities: normalizeAmenitiesForSave(
      payload.storefrontAmenities,
    ),
    storefront_reviews_block: normalizeReviewsForSave(
      payload.storefrontReviewsBlock ?? null,
    ),
    storefront_show_team: payload.storefrontShowTeam ?? true,
    storefront_show_map: payload.storefrontShowMap ?? true,
    storefront_show_reviews: payload.storefrontShowReviews ?? true,
    updated_at: new Date().toISOString(),
  };
  if (trimmedName) {
    orgUpdate.name = trimmedName;
  }

  let { error: orgError } = await supabase
    .from("organizations")
    .update(orgUpdate)
    .eq("id", organizationId);

  if (orgError && isMissingStorefrontSchemaError(orgError.message)) {
    const {
      storefront_gallery_urls: _g,
      storefront_rating_text: _r,
      storefront_eircode: _e,
      storefront_map_lat: _lat,
      storefront_map_lng: _lng,
      storefront_amenities: _a,
      storefront_reviews_block: _rv,
      storefront_show_team: _st,
      storefront_show_map: _sm,
      storefront_show_reviews: _sr,
      ...orgUpdateLegacy
    } = orgUpdate;
    const retry = await supabase
      .from("organizations")
      .update(orgUpdateLegacy)
      .eq("id", organizationId);
    orgError = retry.error;
  }

  if (orgError) {
    return { ok: false, message: orgError.message };
  }

  revalidatePath("/dashboard/storefront");
  revalidatePath("/dashboard", "layout");

  const { data: slugRow } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle();
  if (slugRow?.slug) {
    revalidatePath(`/${slugRow.slug}`);
  }

  return { ok: true };
}
