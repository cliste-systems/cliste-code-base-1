import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  DASHBOARD_LEGAL_ACCEPT_PATH,
  getMissingLegalAcceptances,
  isLegalAcceptanceBypassPath,
  orgNeedsDpaAcceptance,
} from "@/lib/legal-acceptances";
import type { DashboardSession } from "@/lib/dashboard-session";
import { createAdminClient } from "@/utils/supabase/admin";

async function missingLegalAcceptancesForUser(params: {
  userId: string;
  organizationId: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("status, platform_subscription_id, onboarding_step")
    .eq("id", params.organizationId)
    .maybeSingle();

  const needsDpa = orgNeedsDpaAcceptance(org ?? {});
  const missing = await getMissingLegalAcceptances(admin, {
    userId: params.userId,
    organizationId: params.organizationId,
    needsDpa,
  });

  return missing.length > 0;
}

/**
 * Redirects to the acceptance page when the signed-in user has not agreed to
 * the current terms, privacy notice, and (when applicable) DPA.
 */
export async function enforceDashboardLegalAcceptance(
  session: DashboardSession,
): Promise<void> {
  const h = await headers();
  const pathname =
    h.get("x-pathname") ??
    h.get("x-middleware-request-x-pathname") ??
    "";

  // Next.js 16 does not always forward custom middleware headers to layouts.
  // Middleware enforces the gate on /dashboard/*; skip here to avoid redirect loops.
  if (!pathname) {
    return;
  }

  if (isLegalAcceptanceBypassPath(pathname)) {
    return;
  }

  const needsAcceptance = await missingLegalAcceptancesForUser({
    userId: session.user.id,
    organizationId: session.organizationId,
  });

  if (needsAcceptance) {
    redirect(DASHBOARD_LEGAL_ACCEPT_PATH);
  }
}
