/** Shared legal document metadata (safe for client + server). */

export type LegalDocumentType = "terms" | "privacy" | "dpa";

/** ISO date aligned with `LEGAL_LAST_UPDATED` in legal-pages.ts — bump when documents change. */
export const LEGAL_DOCUMENT_VERSIONS: Record<LegalDocumentType, string> = {
  terms: "2026-05-31",
  privacy: "2026-05-31",
  dpa: "2026-05-31",
};

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  terms: "Terms of service",
  privacy: "Privacy notice",
  dpa: "Data Processing Agreement (DPA)",
};

export const LEGAL_DOCUMENT_PATHS: Record<LegalDocumentType, string> = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  dpa: "/legal/dpa",
};

export const DASHBOARD_LEGAL_ACCEPT_PATH = "/dashboard/legal/accept";

/** Paths reachable while contractual acceptances are still outstanding. */
export const LEGAL_ACCEPTANCE_BYPASS_PREFIXES = [
  DASHBOARD_LEGAL_ACCEPT_PATH,
  "/dashboard/legal/terms",
  "/dashboard/legal/privacy",
  "/dashboard/legal/dpa",
  "/dashboard/legal/cookies",
  "/dashboard/legal/sub-processors",
] as const;

export function requiredLegalDocuments(needsDpa: boolean): LegalDocumentType[] {
  const docs: LegalDocumentType[] = ["terms", "privacy"];
  if (needsDpa) docs.push("dpa");
  return docs;
}

export function orgNeedsDpaAcceptance(org: {
  status?: string | null;
  platform_subscription_id?: string | null;
  onboarding_step?: number | null;
}): boolean {
  if (org.status === "active") return true;
  if (String(org.platform_subscription_id ?? "").trim()) return true;
  return (org.onboarding_step ?? 0) >= 7;
}

export function isLegalAcceptanceBypassPath(pathname: string): boolean {
  return LEGAL_ACCEPTANCE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
