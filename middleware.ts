import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_APP_SITE_URL } from "./src/lib/company-details";
import {
  ADMIN_GATE_COOKIE_PREFIX,
  isValidGateCookieValue,
} from "./src/lib/gate-cookie";
import { LEGACY_AUTH_REDIRECTS } from "./src/lib/auth-routes";
import { LEGACY_DASHBOARD_REDIRECTS } from "./src/lib/dashboard-routes";
import { DASHBOARD_LEGAL_ACCEPT_PATH, LEGAL_DOCUMENT_VERSIONS } from "./src/lib/legal-documents";
import { dashboardPathNeedsLegalAcceptance } from "./src/lib/legal-acceptance-middleware";
import { onboardingPathNeedsLegalAcceptance } from "./src/lib/onboarding-legal-middleware";
import { isPublicSignupEnabled } from "./src/lib/public-signup";
import { pathIsAdminLogin, pathIsAgencyAdminSection } from "./src/lib/staff-route-paths";
import { createAdminClient } from "./src/utils/supabase/admin";
import { updateSession } from "./src/utils/supabase/middleware";

const ADMIN_GATE_COOKIE = "cliste_admin_gate";

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

const LEGAL_OK_COOKIE = "cliste_legal_ok";
const LEGAL_OK_VERSION = Object.values(LEGAL_DOCUMENT_VERSIONS).join("|");

async function legalAcceptRedirect(
  request: NextRequest,
  response: NextResponse,
  userId: string | undefined,
): Promise<NextResponse | null> {
  if (!userId) return null;

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) return null;

  if (request.cookies.get(LEGAL_OK_COOKIE)?.value === LEGAL_OK_VERSION) {
    return null;
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) return null;

    const onboardingNeeds = await onboardingPathNeedsLegalAcceptance({
      pathname,
      userId,
      organizationId,
    });
    if (onboardingNeeds) {
      const redirectRes = NextResponse.redirect(
        new URL("/onboarding/legal", request.url),
      );
      copySessionCookies(response, redirectRes);
      return redirectRes;
    }

    const dashboardNeeds = await dashboardPathNeedsLegalAcceptance({
      pathname,
      userId,
      organizationId,
    });
    if (dashboardNeeds) {
      const redirectRes = NextResponse.redirect(
        new URL(DASHBOARD_LEGAL_ACCEPT_PATH, request.url),
      );
      copySessionCookies(response, redirectRes);
      return redirectRes;
    }

    response.cookies.set(LEGAL_OK_COOKIE, LEGAL_OK_VERSION, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60,
      path: "/",
    });
  } catch (err) {
    // Missing service-role key or a Supabase timeout must not 500 sign-in.
    console.error("[middleware] legal acceptance check failed", err);
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const legacyHostRedirect = legacyAppHostRedirect(request);
  if (legacyHostRedirect) return legacyHostRedirect;

  const forwardHeaders = buildForwardRequestHeaders(request);
  const { response, user } = await updateSession(request, forwardHeaders);

  const gatedSignup = signupGateRedirect(request, response, user?.id);
  if (gatedSignup) return gatedSignup;

  const legalRedirect = await legalAcceptRedirect(request, response, user?.id);
  if (legalRedirect) return legalRedirect;

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
