import type { MetadataRoute } from "next";

import { resolveAppSiteOrigin, resolveBookingSiteOrigin } from "@/lib/booking-site-origin";

/**
 * Search-engine sitemap. We deliberately list ONLY the public marketing /
 * legal pages — the per-tenant storefronts (`/[salonSlug]`), pay-link
 * redirects (`/p/...`), and authenticated surfaces (dashboard, admin)
 * are blocked by `public/robots.txt` and shouldn't be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const appOrigin = resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
  const bookOrigin =
    resolveBookingSiteOrigin()?.origin ?? "https://book.clistesystems.ie";
  const lastModified = new Date();

  const appPages = [
    "",
    "/signup",
    "/login",
    "/legal/privacy",
    "/legal/terms",
    "/legal/sub-processors",
    "/legal/cookies",
  ].map((p) => ({
    url: `${appOrigin}${p}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.5,
  }));

  // Booking host root — the tenant directory. Per-salon slugs are NOT
  // listed; we don't want public crawlers indexing every salon page.
  const bookingPages =
    appOrigin === bookOrigin
      ? []
      : [
          {
            url: `${bookOrigin}/`,
            lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.8,
          },
        ];

  return [...appPages, ...bookingPages];
}
