import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ONBOARDING_LEGAL_ACCEPT_PATH,
  isLegalAcceptanceBypassPath,
} from "@/lib/legal-documents";
import { getMissingBaseLegalAcceptances } from "@/lib/onboarding-legal-middleware";
import type { OnboardingSession } from "@/lib/onboarding-session";
import { createAdminClient } from "@/utils/supabase/admin";

async function onboardingPathnameFromHeaders(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? h.get("x-middleware-request-x-pathname") ?? "";
}

/** Redirects onboarding users who have not accepted terms + privacy. */
export async function enforceOnboardingLegalAcceptance(
  session: OnboardingSession,
): Promise<void> {
  const pathname = await onboardingPathnameFromHeaders();
  if (!pathname || isLegalAcceptanceBypassPath(pathname)) {
    return;
  }

  const admin = createAdminClient();
  const missing = await getMissingBaseLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
  });

  if (missing.length > 0) {
    redirect(ONBOARDING_LEGAL_ACCEPT_PATH);
  }
}
