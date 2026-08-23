import {
  LEGAL_DOCUMENT_VERSIONS,
  orgNeedsDpaAcceptance,
  requiredLegalDocuments,
  type LegalDocumentType,
} from "@/lib/legal-documents";
import { createAdminClient } from "@/utils/supabase/admin";

function isCurrentAcceptance(
  documentType: LegalDocumentType,
  documentVersion: string,
): boolean {
  return documentVersion === LEGAL_DOCUMENT_VERSIONS[documentType];
}

export async function userHasCurrentLegalAcceptances(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("status, platform_subscription_id, onboarding_step")
    .eq("id", organizationId)
    .maybeSingle();

  const needsDpa = orgNeedsDpaAcceptance(org ?? {});
  const required = requiredLegalDocuments(needsDpa);

  const { data, error } = await admin
    .from("legal_acceptances")
    .select("document_type, document_version")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .in("document_type", required);

  if (error) {
    console.warn("[legal] failed_to_load_acceptances", error.message);
    return false;
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

  return required.every((doc) => accepted.has(doc));
}
