const SCRIPT_ATTR = "data-cliste-google-maps";

/**
 * Loads the Google Maps JavaScript API with the Places library (client-only).
 * Used for directory search autocomplete on book.clistesystems.ie.
 */
export function loadGoogleMapsPlacesApi(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps is client-only."));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  const existing = document.querySelector(
    `script[${SCRIPT_ATTR}="1"]`,
  ) as HTMLScriptElement | null;

  if (existing) {
    return new Promise((resolve, reject) => {
      const finish = () => {
        if (window.google?.maps?.places) resolve();
        else reject(new Error("Google Maps loaded without Places."));
      };
      if (window.google?.maps?.places) {
        finish();
        return;
      }
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps script error")),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute(SCRIPT_ATTR, "1");
    script.onload = () => {
      if (window.google?.maps?.places) resolve();
      else reject(new Error("Google Maps loaded without Places."));
    };
    script.onerror = () =>
      reject(new Error("Google Maps script failed to load."));
    document.head.appendChild(script);
  });
}
