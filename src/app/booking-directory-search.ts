"use server";

import { createClient } from "@/utils/supabase/server";

export type PublicSalonDirectoryRow = {
  slug: string;
  name: string;
  address: string | null;
};

/**
 * Public directory search (anon RLS: active organizations only).
 * When service/location text is set, keeps venues whose name, slug, address,
 * or bio contains every token. If that would hide everyone, falls back to
 * all active venues so a first deploy with one salon still shows it.
 */
export async function searchPublicSalonsDirectory(input: {
  service: string;
  location: string;
  date: string;
}): Promise<
  | { ok: true; salons: PublicSalonDirectoryRow[] }
  | { ok: false; message: string }
> {
  void input.date;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("slug, name, address, bio_text")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return { ok: false, message: error.message };
  }

  const normalized = (data ?? [])
    .filter((r) => Boolean(r.slug?.trim()) && Boolean(r.name?.trim()))
    .map((r) => ({
      slug: String(r.slug).trim(),
      name: String(r.name).trim(),
      address: r.address?.trim() ?? null,
      bio_text: r.bio_text?.trim() ?? null,
    }));

  const tokens = [input.service, input.location]
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  if (tokens.length === 0) {
    return {
      ok: true,
      salons: normalized.map(({ slug, name, address }) => ({
        slug,
        name,
        address,
      })),
    };
  }

  const haystack = (r: (typeof normalized)[0]) =>
    [r.name, r.address, r.slug, r.bio_text]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const strict = normalized.filter((r) =>
    tokens.every((t) => haystack(r).includes(t)),
  );

  const picked = strict.length > 0 ? strict : normalized;

  return {
    ok: true,
    salons: picked.map(({ slug, name, address }) => ({ slug, name, address })),
  };
}
