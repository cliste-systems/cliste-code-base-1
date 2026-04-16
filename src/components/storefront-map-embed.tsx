"use client";

import { MapPin } from "lucide-react";

/**
 * Google Maps satellite embed. Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
 * (Maps Embed API must be enabled on the GCP project, and the key should be
 * restricted to the production domain).
 *
 * When the key is missing we render a neutral placeholder rather than an
 * OSM iframe — the product is now Google-only per operator decision.
 */
export function StorefrontMapEmbed({
  lat,
  lng,
  title,
  zoom = 18,
  mapType = "satellite",
}: {
  lat: number;
  lng: number;
  title: string;
  zoom?: number;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  if (!key) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-4 w-4" />
          <span>Map unavailable — Google Maps key not configured.</span>
        </div>
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(
    key,
  )}&center=${lat},${lng}&zoom=${zoom}&maptype=${mapType}`;

  return (
    <iframe
      title={title}
      className="absolute inset-0 h-full w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={src}
      allowFullScreen
    />
  );
}
