/**
 * Single place for dashboard/public display of the business title.
 * When `name` was saved as the generic placeholder "Salon" but `slug` still
 * reflects the admin-created URL (e.g. last-look-hair), prefer the slug.
 */
export function resolveOrganizationDisplayName(
  name: string | null | undefined,
  slug: string | null | undefined,
): string {
  const n = name?.trim() ?? "";
  const s = slug?.trim() ?? "";

  const titleFromSlug = (value: string) =>
    value
      .split("-")
      .filter(Boolean)
      .map((w) => {
        const lower = w.toLowerCase();
        return w.length ? w.charAt(0).toUpperCase() + lower.slice(1) : "";
      })
      .join(" ");

  const slugTitle = s ? titleFromSlug(s) : "";

  if (
    n.toLowerCase() === "salon" &&
    slugTitle &&
    s.toLowerCase() !== "salon"
  ) {
    return slugTitle;
  }

  if (n) return n;
  if (slugTitle) return slugTitle;
  return "";
}
