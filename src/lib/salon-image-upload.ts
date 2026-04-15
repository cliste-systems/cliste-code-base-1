import { randomUUID } from "crypto";

import { createAdminClient } from "@/utils/supabase/admin";

export const SALON_IMAGES_BUCKET = "salon-logos";
export const MAX_SALON_IMAGE_BYTES = 2 * 1024 * 1024;
/** If Storage upload fails, allow embedding small images as data URLs (same as logo/gallery). */
export const MAX_INLINE_SALON_IMAGE_BYTES = 220_000;

export function parseSalonImageDataUrl(
  dataUrl: string,
): { buffer: Buffer; contentType: string; ext: string } | null {
  const m = dataUrl
    .trim()
    .match(/^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.+)$/i);
  if (!m) return null;
  let contentType = m[1].toLowerCase();
  if (contentType === "image/jpg") contentType = "image/jpeg";
  const b64 = m[2].replace(/\s/g, "");
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > MAX_SALON_IMAGE_BYTES) return null;
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : contentType === "image/gif"
          ? "gif"
          : "jpg";
  return { buffer, contentType, ext };
}

/**
 * Upload a browser data URL to public `salon-logos` storage; returns public HTTPS URL
 * (or inline data URL fallback when file is small enough and upload fails).
 */
export async function uploadSalonImageFromDataUrl(
  organizationId: string,
  dataUrl: string,
  kind: "logo" | "gallery" | "team",
): Promise<string> {
  const parsed = parseSalonImageDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Invalid image. Use PNG, JPG, WebP, or GIF.");
  }

  const path =
    kind === "gallery"
      ? `${organizationId}/gallery/${randomUUID()}.${parsed.ext}`
      : kind === "team"
        ? `${organizationId}/team/${randomUUID()}.${parsed.ext}`
        : `${organizationId}/${randomUUID()}.${parsed.ext}`;

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(SALON_IMAGES_BUCKET)
      .upload(path, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: false,
      });
    if (error) throw error;
    const { data } = admin.storage.from(SALON_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    if (parsed.buffer.length <= MAX_INLINE_SALON_IMAGE_BYTES) {
      return dataUrl.trim();
    }
    throw new Error(
      kind === "team"
        ? "Could not upload team photo. Try a smaller file (under ~200KB) or check storage."
        : kind === "gallery"
          ? "Could not upload gallery image. Try a smaller file (under ~200KB) or check storage."
          : "Could not upload logo. Try a smaller image (under ~200KB) or ensure the salon-logos storage bucket exists.",
    );
  }
}
