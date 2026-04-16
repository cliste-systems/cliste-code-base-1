import { type NextRequest, NextResponse } from "next/server";

import { hostMatchesConfiguredBookingHost } from "./src/lib/booking-site-origin";
import { clisteHostRoutingRedirect } from "./src/lib/cliste-host-routing";
import {
  pathIsAgencyAdminSection,
  pathIsTenantDashboardSection,
} from "./src/lib/staff-route-paths";
import {
  isValidSupportDashboardCookieValue,
  SUPPORT_DASHBOARD_COOKIE,
} from "./src/lib/support-dashboard-cookie";
import { timingSafeEqualUtf8 } from "./src/lib/timing-safe-equal";
import { updateSession } from "./src/utils/supabase/middleware";

const ADMIN_GATE_COOKIE = "cliste_admin_gate";

function copySessionCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c);
  }
}

function rootToLoginRedirect(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  if (request.nextUrl.pathname !== "/") return response;
  const reqHost = request.headers.get("host");
  if (hostMatchesConfiguredBookingHost(reqHost)) return response;

  const redirectRes = NextResponse.redirect(new URL("/authenticate", request.url));
  copySessionCookies(response, redirectRes);
  return redirectRes;
}

/**
 * Extra password layer for /dashboard (all environments). Separate from Supabase sign-in.
 * Internal /admin is not gated in-app — protect /admin at your host if needed.
 */
async function dashboardGate(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  if (!pathIsTenantDashboardSection(path)) return response;

  const secret = process.env.CLISTE_DASHBOARD_GATE_SECRET?.trim();
  if (!secret) {
    if (path === "/dashboard-unlock") return response;
    const redirectRes = NextResponse.redirect(
      new URL("/dashboard-unlock?error=config", request.url)
    );
    copySessionCookies(response, redirectRes);
    return redirectRes;
  }

  if (path === "/dashboard-unlock") return response;

  // Admin "Open dashboard" launches set this cookie; bypass the extra gate
  // so support can jump straight into the tenant dashboard.
  const supportView = await isValidSupportDashboardCookieValue(
    request.cookies.get(SUPPORT_DASHBOARD_COOKIE)?.value
  );
  if (supportView) return response;

  const cookie = request.cookies.get("cliste_dashboard_gate")?.value ?? "";
  if (!(await timingSafeEqualUtf8(cookie, secret))) {
    const redirectRes = NextResponse.redirect(
      new URL("/dashboard-unlock", request.url)
    );
    copySessionCookies(response, redirectRes);
    return redirectRes;
  }

  return response;
}

/**
 * Extra password gate for /admin routes. This is separate from salon login and
 * must be set in deploy envs to keep internal pages private.
 */
async function adminGate(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  if (!pathIsAgencyAdminSection(path)) return response;

  const secret = process.env.CLISTE_ADMIN_SECRET?.trim();
  if (!secret) {
    if (path === "/admin-unlock") return response;
    const redirectRes = NextResponse.redirect(
      new URL("/admin-unlock?error=config", request.url)
    );
    copySessionCookies(response, redirectRes);
    return redirectRes;
  }

  if (path === "/admin-unlock") return response;

  const cookie = request.cookies.get(ADMIN_GATE_COOKIE)?.value ?? "";
  if (!(await timingSafeEqualUtf8(cookie, secret))) {
    const redirectRes = NextResponse.redirect(
      new URL("/admin-unlock", request.url)
    );
    copySessionCookies(response, redirectRes);
    return redirectRes;
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const hostRedirect = clisteHostRoutingRedirect(request);
  if (hostRedirect) return hostRedirect;

  const response = await updateSession(request);
  const maybeRootRedirect = rootToLoginRedirect(request, response);
  if (maybeRootRedirect !== response) return maybeRootRedirect;
  const gatedAdmin = await adminGate(request, response);
  return dashboardGate(request, gatedAdmin);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
