import "server-only";

import {
  LEGAL_DOCUMENT_VERSIONS,
  type LegalDocumentType,
} from "@/lib/legal-documents";
import type { SupabaseClient } from "@supabase/supabase-js";

function isCurrentAcceptance(
  documentType: LegalDocumentType,
  documentVersion: string,
): boolean {
  return documentVersion === LEGAL_DOCUMENT_VERSIONS[documentType];
}

/** Terms + privacy only — required before onboarding continues. */
export async function getMissingBaseLegalAcceptances(
  admin: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
  },
): Promise<LegalDocumentType[]> {
  const required: LegalDocumentType[] = ["terms", "privacy"];

  const { data, error } = await admin
    .from("legal_acceptances")
    .select("document_type, document_version")
    .eq("user_id", params.userId)
    .eq("organization_id", params.organizationId)
    .in("document_type", required);

  if (error) {
    console.warn("[legal] failed_to_load_base_acceptances", error.message);
    return required;
  }

  const accepted = new Set<LegalDocumentType>();
  for (const row of data ?? []) {
    const type = row.document_type as LegalDocumentType;
    if (
      required.includes(type) &&
      isCurrentAcceptance(type, row.document_version)
    ) {
      accepted.add(type);
    }
  }

  return required.filter((doc) => !accepted.has(doc));
}

export async function onboardingPathNeedsLegalAcceptance(params: {
  pathname: string;
  userId: string;
  organizationId: string;
}): Promise<boolean> {
  if (!params.pathname.startsWith("/onboarding")) return false;
  if (
    params.pathname === "/onboarding/legal" ||
    params.pathname.startsWith("/onboarding/legal/")
  ) {
    return false;
  }

  const admin = (await import("@/utils/supabase/admin")).createAdminClient();
  const missing = await getMissingBaseLegalAcceptances(admin, {
    userId: params.userId,
    organizationId: params.organizationId,
  });

  return missing.length > 0;
}
