/**
 * Resolves production app vs public booking hostnames from env.
 * Used by middleware (host redirects) and client links (e.g. "View live").
 */

export function parseConfiguredOrigin(raw: string | undefined): URL | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    return new URL(t.startsWith("http") ? t : `https://${t}`);
  } catch {
    return null;
  }
}

export function resolveAppSiteOrigin(): URL | null {
  return parseConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

/** Public customer storefront origin (`book.*` or explicit `NEXT_PUBLIC_BOOKING_URL`). */
export function resolveBookingSiteOrigin(): URL | null {
  const explicit = parseConfiguredOrigin(process.env.NEXT_PUBLIC_BOOKING_URL);
  if (explicit) return explicit;

  const app = resolveAppSiteOrigin();
  if (!app || !app.hostname.startsWith("app.")) return null;

  const u = new URL(app.href);
  u.hostname = `book.${app.hostname.slice(4)}`;
  return u;
}

/** Absolute booking URL when booking host is configured; otherwise same-path on current host. */
export function getPublicBookingPageUrl(pathFromRoot: string): string {
  const path = pathFromRoot.startsWith("/") ? pathFromRoot : `/${pathFromRoot}`;
  const booking = resolveBookingSiteOrigin();
  if (booking) return `${booking.origin}${path}`;
  return path;
}
