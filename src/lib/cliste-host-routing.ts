import { type NextRequest, NextResponse } from "next/server";

function parseOrigin(raw: string | undefined): URL | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    return new URL(t.startsWith("http") ? t : `https://${t}`);
  } catch {
    return null;
  }
}

/** Single path segment at root that is not a public salon slug. */
const RESERVED_APP_ROOT_SEGMENTS = new Set(
  [
    "api",
    "_next",
    "authenticate",
    "login",
    "auth",
    "dashboard",
    "admin",
    "admin-unlock",
    "dashboard-unlock",
    "favicon.ico",
  ].map((s) => s.toLowerCase()),
);

function requestHostname(request: NextRequest): string | null {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  return host || null;
}

function bookingOriginFromEnv(): URL | null {
  const explicit = parseOrigin(process.env.NEXT_PUBLIC_BOOKING_URL);
  if (explicit) return explicit;

  const app = parseOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (!app || !app.hostname.startsWith("app.")) return null;

  const u = new URL(app.href);
  u.hostname = `book.${app.hostname.slice(4)}`;
  return u;
}

/**
 * Keep customer storefront on `book.*` and staff routes on `app.*` when both
 * hosts are configured (production). No-op on other hosts (e.g. preview, localhost).
 */
export function clisteHostRoutingRedirect(
  request: NextRequest,
): NextResponse | null {
  const appOrigin = parseOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const bookingOrigin = bookingOriginFromEnv();
  if (!appOrigin || !bookingOrigin) return null;

  const appHost = appOrigin.hostname;
  const bookHost = bookingOrigin.hostname;
  if (appHost === bookHost) return null;

  const host = requestHostname(request);
  if (!host || (host !== appHost && host !== bookHost)) return null;

  const path = request.nextUrl.pathname;
  const pathAndQuery = `${path}${request.nextUrl.search}`;

  if (host === appHost) {
    const m = path.match(/^\/([^/]+)\/?$/);
    if (!m) return null;
    const seg = m[1].toLowerCase();
    if (RESERVED_APP_ROOT_SEGMENTS.has(seg)) return null;
    return NextResponse.redirect(new URL(pathAndQuery, bookingOrigin));
  }

  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path === "/login" ||
    path.startsWith("/login/") ||
    path.startsWith("/dashboard-unlock") ||
    path.startsWith("/admin-unlock")
  ) {
    return NextResponse.redirect(new URL(pathAndQuery, appOrigin));
  }

  return null;
}
