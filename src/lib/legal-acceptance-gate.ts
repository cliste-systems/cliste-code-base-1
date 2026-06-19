import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isDashboardAccessGatePath } from "@/lib/dashboard-access-gate";
import {
  DASHBOARD_LEGAL_ACCEPT_PATH,
  getMissingLegalAcceptances,
  isLegalAcceptanceBypassPath,
  orgNeedsDpaAcceptance,
} from "@/lib/legal-acceptances";
import type { DashboardSession } from "@/lib/dashboard-session";
import { createAdminClient } from "@/utils/supabase/admin";

export async function dashboardUserNeedsLegalAcceptance(
  session: DashboardSession,
): Promise<boolean> {
  if (session.isLocalPreview) {
    return false;
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("status, platform_subscription_id, onboarding_step")
    .eq("id", session.organizationId)
    .maybeSingle();

  const needsDpa = orgNeedsDpaAcceptance(org ?? {});
  const missing = await getMissingLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
    needsDpa,
  });

  return missing.length > 0;
}

export async function dashboardPathnameFromHeaders(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? h.get("x-middleware-request-x-pathname") ?? "";
}

/**
 * Redirects to the acceptance page when the signed-in user has not agreed to
 * the current terms, privacy notice, and (when applicable) DPA.
 */
export async function enforceDashboardLegalAcceptance(
  session: DashboardSession,
): Promise<void> {
  if (session.isLocalPreview) {
    return;
  }

  const pathname = await dashboardPathnameFromHeaders();

  // Middleware enforces the gate on /dashboard/*; skip here to avoid redirect loops
  // when the pathname header is unavailable in this render.
  if (!pathname) {
    return;
  }

  if (isLegalAcceptanceBypassPath(pathname)) {
    return;
  }

  const needsAcceptance = await dashboardUserNeedsLegalAcceptance(session);

  if (needsAcceptance) {
    redirect(DASHBOARD_LEGAL_ACCEPT_PATH);
  }
}

export async function dashboardShouldUseGateShell(
  session: DashboardSession,
  pathname: string,
): Promise<boolean> {
  if (session.isLocalPreview || !pathname) {
    return false;
  }

  if (!isDashboardAccessGatePath(pathname)) {
    return false;
  }

  return dashboardUserNeedsLegalAcceptance(session);
}
