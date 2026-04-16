"use client";

import { Compass } from "lucide-react";

/**
 * Google Maps Street View embed (Maps Embed API). Works globally including
 * Ireland — unlike the Aerial View API, which only renders US addresses.
 *
 * Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with the Maps Embed API enabled
 * on the GCP project. Falls back to a neutral placeholder otherwise so the
 * card never renders a broken iframe.
 */
export function StorefrontStreetView({
  lat,
  lng,
  title,
  heading = 0,
  pitch = 0,
  fov = 90,
}: {
  lat: number;
  lng: number;
  title: string;
  heading?: number;
  pitch?: number;
  fov?: number;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  if (!key) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
        <div className="flex items-center gap-2 text-xs">
          <Compass className="h-4 w-4" />
          <span>Street View unavailable — Google Maps key not configured.</span>
        </div>
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(
    key,
  )}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}`;

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
