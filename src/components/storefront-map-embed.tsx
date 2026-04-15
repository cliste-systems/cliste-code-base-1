"use client";

/**
 * Satellite-style map when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set (Maps Embed API).
 * Falls back to an OpenStreetMap embed (street map) using the same coordinates.
 */
export function StorefrontMapEmbed({
  lat,
  lng,
  title,
}: {
  lat: number;
  lng: number;
  title: string;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const pad = 0.004;
  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;

  if (key) {
    const gSrc = `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(key)}&center=${lat},${lng}&zoom=18&maptype=satellite`;
    return (
      <iframe
        title={title}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={gSrc}
        allowFullScreen
      />
    );
  }

  return (
    <iframe
      title={title}
      className="absolute inset-0 h-full w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={osmSrc}
    />
  );
}
