import type { MetadataRoute } from "next";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";

/**
 * Search-engine sitemap. Lists public marketing / legal pages only.
 * Authenticated surfaces and legacy salon slug routes are excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const appOrigin = resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
  const lastModified = new Date();

  return [
    "",
    "/signup",
    "/login",
    "/legal/privacy",
    "/legal/terms",
    "/legal/dpa",
    "/legal/sub-processors",
    "/legal/cookies",
  ].map((p) => ({
    url: `${appOrigin}${p}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.5,
  }));
}
