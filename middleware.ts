import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_APP_SITE_URL } from "./src/lib/company-details";
import {
  ADMIN_GATE_COOKIE_PREFIX,
  isValidGateCookieValue,
} from "./src/lib/gate-cookie";
import { LEGACY_AUTH_REDIRECTS } from "./src/lib/auth-routes";
import { LEGACY_DASHBOARD_REDIRECTS } from "./src/lib/dashboard-routes";
import { isPublicSignupEnabled } from "./src/lib/public-signup";
import { pathIsAdminLogin, pathIsAgencyAdminSection } from "./src/lib/staff-route-paths";
import { timingSafeEqualUtf8 } from "./src/lib/timing-safe-equal";
import { updateSession } from "./src/utils/supabase/middleware";

const ADMIN_GATE_COOKIE = "cliste_admin_gate";
const EDGE_HEADER = "x-cliste-edge";

function pathBypassesEdgeAuth(pathname: string): boolean {
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/voice/")) return true;
  if (pathname.startsWith("/monitoring")) return true;
  return false;
}

async function rejectDirectOriginWithoutEdgeSecret(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== "production") return null;
  const path = request.nextUrl.pathname;
  if (pathBypassesEdgeAuth(path)) return null;

  const secret = process.env.CLISTE_EDGE_SHARED_SECRET?.trim();
  if (!secret) {
    console.error("[middleware] CLISTE_EDGE_SHARED_SECRET missing in production");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const provided = request.headers.get(EDGE_HEADER) ?? "";
  const ok = await timingSafeEqualUtf8(provided, secret);
  if (!ok) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return null;
}

const LEGACY_APP_HOSTS = new Set(["app.clistesystems.ie"]);

function legacyAppHostRedirect(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || !LEGACY_APP_HOSTS.has(host)) return null;
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    DEFAULT_APP_SITE_URL,
  );
  return NextResponse.redirect(destination, 308);
}

function copySessionCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c);
  }
}

function rootToLoginRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (request.nextUrl.pathname !== "/") return response;
  const redirectRes = NextResponse.redirect(new URL("/authenticate", request.url));
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Mistyped sign-in URLs (e.g. `/signin`) must not match `/[salonSlug]`. */
function legacyAuthPathRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  const target = LEGACY_AUTH_REDIRECTS[path];
  if (!target) return response;
  const url = new URL(target, request.url);
  url.search = request.nextUrl.search;
  const redirectRes = NextResponse.redirect(url);
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Canonical dashboard URLs (Calls, Contacts, Usage, Cara Setup). */
function legacyDashboardPathRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  const target = LEGACY_DASHBOARD_REDIRECTS[path];
  if (!target) return response;
  const url = new URL(target, request.url);
  url.search = request.nextUrl.search;
  const redirectRes = NextResponse.redirect(url);
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/**
 * Retail pilot: public self-serve signup is frozen. `/signup` is closed for
 * everyone; `/onboarding` is closed for signed-out visitors (a signed-in
 * account that is mid-wizard may still finish it). Admin-invited users never
 * touch these paths — they land on /auth/callback and set a password.
 */
function signupGateRedirect(
  request: NextRequest,
  response: NextResponse,
  userId: string | undefined,
): NextResponse | null {
  if (isPublicSignupEnabled()) return null;
  const path = request.nextUrl.pathname;
  const isSignup = path === "/signup" || path.startsWith("/signup/");
  const isOnboarding =
    path === "/onboarding" || path.startsWith("/onboarding/");
  if (!isSignup && !(isOnboarding && !userId)) return null;
  const redirectRes = NextResponse.redirect(
    new URL("/authenticate", request.url),
  );
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Legacy URL — extra dashboard password gate was removed for v1 pilot. */
function dashboardUnlockRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  if (path !== "/dashboard-unlock" && !path.startsWith("/dashboard-unlock/")) {
    return response;
  }
  const redirectRes = NextResponse.redirect(new URL("/dashboard", request.url));
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/** Legacy URL — renamed to /admin/login. */
function legacyAdminUnlockRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const path = request.nextUrl.pathname;
  if (path !== "/admin-unlock" && !path.startsWith("/admin-unlock/")) {
    return response;
  }
  const url = new URL("/admin/login", request.url);
  url.search = request.nextUrl.search;
  const redirectRes = NextResponse.redirect(url);
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/**
 * Extra password gate for /admin routes. This is separate from tenant sign-in and
 * must be set in deploy envs to keep internal pages private.
 */
async function adminGate(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  if (!pathIsAgencyAdminSection(path)) return response;

  const secret = process.env.CLISTE_ADMIN_SECRET?.trim();
  if (!secret) {
    if (pathIsAdminLogin(path)) return response;
    const redirectRes = NextResponse.redirect(
      new URL("/admin/login?error=config", request.url),
    );
    copySessionCookies(response, redirectRes);
    return redirectRes;
  }

  if (pathIsAdminLogin(path)) return response;

  const cookie = request.cookies.get(ADMIN_GATE_COOKIE)?.value ?? "";
  const ok = await isValidGateCookieValue(
    cookie,
    ADMIN_GATE_COOKIE_PREFIX,
    secret,
  );
  if (!ok) {
    const redirectRes = NextResponse.redirect(
      new URL("/admin/login", request.url),
    );
    copySessionCookies(response, redirectRes);
    return redirectRes;
  }

  return response;
}

function buildForwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return headers;
}

export async function middleware(request: NextRequest) {
  const edgeReject = await rejectDirectOriginWithoutEdgeSecret(request);
  if (edgeReject) return edgeReject;

  const legacyHostRedirect = legacyAppHostRedirect(request);
  if (legacyHostRedirect) return legacyHostRedirect;

  const forwardHeaders = buildForwardRequestHeaders(request);
  const { response, user } = await updateSession(request, forwardHeaders);

  const gatedSignup = signupGateRedirect(request, response, user?.id);
  if (gatedSignup) return gatedSignup;

  const maybeRootRedirect = rootToLoginRedirect(request, response);
  if (maybeRootRedirect !== response) return maybeRootRedirect;
  const authAliasRedirect = legacyAuthPathRedirect(request, response);
  if (authAliasRedirect !== response) return authAliasRedirect;
  const legacyNavRedirect = legacyDashboardPathRedirect(request, response);
  if (legacyNavRedirect !== response) return legacyNavRedirect;
  const unlockRedirect = dashboardUnlockRedirect(request, response);
  if (unlockRedirect !== response) return unlockRedirect;
  const legacyAdminRedirect = legacyAdminUnlockRedirect(request, response);
  if (legacyAdminRedirect !== response) return legacyAdminRedirect;
  return adminGate(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
