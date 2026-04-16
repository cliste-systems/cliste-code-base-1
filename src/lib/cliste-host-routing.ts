import { type NextRequest, NextResponse } from "next/server";

import {
  resolveAppSiteOrigin,
  resolveBookingSiteOrigin,
} from "./booking-site-origin";

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

/**
 * Keep customer storefront on `book.*` and staff routes on `app.*` when both
 * hosts are configured (production). No-op on other hosts (e.g. preview, localhost).
 */
export function clisteHostRoutingRedirect(
  request: NextRequest,
): NextResponse | null {
  const appOrigin = resolveAppSiteOrigin();
  const bookingOrigin = resolveBookingSiteOrigin();
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
