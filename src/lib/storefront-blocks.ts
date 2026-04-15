import { MAX_INLINE_SALON_IMAGE_BYTES } from "@/lib/salon-image-upload";

/** Max stored length for inline data URLs (fallback when storage upload fails). */
const MAX_TEAM_IMAGE_DATA_URL_CHARS =
  Math.min(400_000, Math.ceil(MAX_INLINE_SALON_IMAGE_BYTES * 1.4) + 500);

export type StorefrontTeamMember = {
  name: string;
  imageUrl?: string | null;
  /** Set server-side on the public booking page when a profile matches the name */
  staffProfileId?: string | null;
};

export type StorefrontReviewEntry = {
  name: string;
  body: string;
  relativeTime?: string;
};

export type StorefrontReviewsBlock = {
  score?: string | null;
  entries?: StorefrontReviewEntry[];
};

export function parseStorefrontAmenityLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (t) out.push(t.slice(0, 80));
  }
  return out.slice(0, 20);
}

export function parseStorefrontTeamMembers(raw: unknown): StorefrontTeamMember[] {
  if (!Array.isArray(raw)) return [];
  const out: StorefrontTeamMember[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as { name?: unknown; imageUrl?: unknown };
    const name =
      typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
    if (!name) continue;
    let imageUrl: string | null = null;
    if (typeof o.imageUrl === "string") {
      const u = o.imageUrl.trim();
      if (/^https?:\/\//i.test(u)) imageUrl = u.slice(0, 2048);
      else if (
        /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(u) &&
        u.length <= MAX_TEAM_IMAGE_DATA_URL_CHARS
      ) {
        imageUrl = u;
      }
    }
    out.push(imageUrl ? { name, imageUrl } : { name });
    if (out.length >= 12) break;
  }
  return out;
}

export function parseStorefrontReviewsBlock(
  raw: unknown,
): StorefrontReviewsBlock | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  let score: string | null = null;
  if (typeof o.score === "string" && o.score.trim()) {
    score = o.score.trim().slice(0, 12);
  }
  const entries: StorefrontReviewEntry[] = [];
  if (Array.isArray(o.entries)) {
    for (const e of o.entries) {
      if (!e || typeof e !== "object") continue;
      const r = e as { name?: unknown; body?: unknown; relativeTime?: unknown };
      const name =
        typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
      const body =
        typeof r.body === "string" ? r.body.trim().slice(0, 600) : "";
      if (!name || !body) continue;
      const relativeTime =
        typeof r.relativeTime === "string"
          ? r.relativeTime.trim().slice(0, 40)
          : undefined;
      entries.push(
        relativeTime ? { name, body, relativeTime } : { name, body },
      );
      if (entries.length >= 8) break;
    }
  }
  if (!score && entries.length === 0) return null;
  return { score: score ?? undefined, entries };
}
