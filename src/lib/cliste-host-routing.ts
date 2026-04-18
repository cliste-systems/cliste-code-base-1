import { type NextRequest, NextResponse } from "next/server";

import {
  resolveAppSiteOrigin,
  resolveBookingSiteOrigin,
} from "./booking-site-origin";
import { pathIsStaffRouteRedirectingBookToApp } from "./staff-route-paths";

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
  // Hardening: refuse to redirect a path that could resolve to a different
  // host. `new URL("//evil.com/x", "https://app.example")` parses to
  // `https://evil.com/x` because `//host` is a scheme-relative URL. We
  // require a single leading slash followed by a non-slash byte before
  // composing the target URL — otherwise any future caller that lets a
  // user-supplied path reach this helper could be turned into an open
  // redirect.
  if (!/^\/(?:[^/]|$)/.test(path)) return null;
  const pathAndQuery = `${path}${request.nextUrl.search}`;

  if (host === appHost) {
    const m = path.match(/^\/([^/]+)\/?$/);
    if (!m) return null;
    const seg = m[1].toLowerCase();
    if (RESERVED_APP_ROOT_SEGMENTS.has(seg)) return null;
    return NextResponse.redirect(new URL(pathAndQuery, bookingOrigin));
  }

  if (pathIsStaffRouteRedirectingBookToApp(path)) {
    return NextResponse.redirect(new URL(pathAndQuery, appOrigin));
  }

  return null;
}
