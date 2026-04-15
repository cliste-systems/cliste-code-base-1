import { type NextRequest, NextResponse } from "next/server";

import {
  isValidSupportDashboardCookieValue,
  SUPPORT_DASHBOARD_COOKIE,
} from "./src/lib/support-dashboard-cookie";
import { timingSafeEqualUtf8 } from "./src/lib/timing-safe-equal";
import { updateSession } from "./src/utils/supabase/middleware";

function copySessionCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c);
  }
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
  if (!path.startsWith("/dashboard")) return response;

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

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  return dashboardGate(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
