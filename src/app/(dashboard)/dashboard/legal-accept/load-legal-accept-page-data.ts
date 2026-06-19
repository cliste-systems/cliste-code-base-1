import "server-only";

import { redirect } from "next/navigation";

import {
  getMissingLegalAcceptances,
  orgNeedsDpaAcceptance,
  type LegalDocumentType,
} from "@/lib/legal-acceptances";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { createAdminClient } from "@/utils/supabase/admin";

export type LegalAcceptPageData = {
  missing: LegalDocumentType[];
};

export async function loadLegalAcceptPageData(): Promise<LegalAcceptPageData> {
  const session = await requireDashboardSession();
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

  if (missing.length === 0) {
    redirect("/dashboard");
  }

  return { missing };
}
