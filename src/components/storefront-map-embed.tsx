"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";

/**
 * Salon map preview: Google **Static Maps** (satellite) inside a styled link.
 * Avoids the heavy default Maps Embed chrome; tap opens full Google Maps.
 *
 * Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with **Maps Static API** enabled
 * (and HTTP referrer restrictions matching this app).
 */
export function StorefrontMapEmbed({
  lat,
  lng,
  title,
  zoom = 17,
}: {
  lat: number;
  lng: number;
  title: string;
  zoom?: number;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const [imgFailed, setImgFailed] = useState(false);

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

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  const staticSrc = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=640x320&scale=2&maptype=satellite&markers=color:0x1d4ed8%7Csize:mid%7C${lat},${lng}&key=${encodeURIComponent(key)}`;

  if (imgFailed) {
    return (
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 px-4 text-center text-xs text-gray-600 transition-colors hover:bg-gray-200"
      >
        <MapPin className="h-6 w-6 text-gray-400" />
        <span>Could not load map preview.</span>
        <span className="font-medium text-blue-700">Open in Google Maps</span>
      </a>
    );
  }

  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="group/map absolute inset-0 block overflow-hidden bg-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={staticSrc}
        alt={title}
        className="h-full w-full object-cover transition-[transform,filter] duration-500 ease-out group-hover/map:scale-[1.03] group-hover/map:brightness-105"
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-4">
        <span className="max-w-[70%] truncate text-[11px] font-medium tracking-wide text-white/95 drop-shadow-sm sm:text-xs">
          Satellite preview — tap for Google Maps
        </span>
        <span className="shrink-0 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold tracking-wide text-gray-900 shadow-sm sm:text-[11px]">
          Maps
        </span>
      </div>
    </a>
  );
}
