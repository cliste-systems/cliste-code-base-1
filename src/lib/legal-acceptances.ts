import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LEGAL_DOCUMENT_VERSIONS,
  requiredLegalDocuments,
  type LegalDocumentType,
} from "@/lib/legal-documents";
import type { SecurityEventContext } from "@/lib/security-events";

export type { LegalDocumentType } from "@/lib/legal-documents";
export {
  DASHBOARD_LEGAL_ACCEPT_PATH,
  isLegalAcceptanceBypassPath,
  orgNeedsDpaAcceptance,
  requiredLegalDocuments,
} from "@/lib/legal-documents";

function isCurrentAcceptance(
  documentType: LegalDocumentType,
  documentVersion: string,
): boolean {
  return documentVersion === LEGAL_DOCUMENT_VERSIONS[documentType];
}

export async function getMissingLegalAcceptances(
  admin: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    needsDpa: boolean;
  },
): Promise<LegalDocumentType[]> {
  const required = requiredLegalDocuments(params.needsDpa);

  const { data, error } = await admin
    .from("legal_acceptances")
    .select("document_type, document_version")
    .eq("user_id", params.userId)
    .eq("organization_id", params.organizationId)
    .in("document_type", required);

  if (error) {
    console.warn("[legal] failed_to_load_acceptances", error.message);
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

export async function recordLegalAcceptances(
  admin: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    documents: LegalDocumentType[];
    context?: SecurityEventContext;
  },
): Promise<void> {
  const rows = params.documents.map((documentType) => ({
    user_id: params.userId,
    organization_id: params.organizationId,
    document_type: documentType,
    document_version: LEGAL_DOCUMENT_VERSIONS[documentType],
    ip_hash: params.context?.ipHash ?? null,
    user_agent: params.context?.userAgent ?? null,
  }));

  if (rows.length === 0) return;

  const { error } = await admin.from("legal_acceptances").insert(rows);
  if (error) {
    console.warn("[legal] failed_to_record_acceptances", error.message);
    throw new Error("Could not record legal acceptance. Please try again.");
  }
}
