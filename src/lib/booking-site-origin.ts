/**
 * Resolves the production app hostname from env (dashboard, billing links).
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

/** When `Host` is missing (e.g. some server actions); must match `npm run dev` port in package.json. */
export const LOCAL_DEV_APP_ORIGIN = "http://localhost:3001";
