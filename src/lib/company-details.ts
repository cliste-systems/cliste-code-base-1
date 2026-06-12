/** Cliste Systems Ltd company details for public legal documents. */

export const CLISTE_COMPANY = {
  legalName: "Cliste Systems",
  jurisdiction: "Ireland",
  /** Set CLISTE_CRO_NUMBER in production env for public display. */
  croNumber: process.env.CLISTE_CRO_NUMBER?.trim() || null,
  /** Set CLISTE_REGISTERED_OFFICE in production env for public display. */
  registeredOffice:
    process.env.CLISTE_REGISTERED_OFFICE?.trim() || "Dublin, Ireland",
  privacyEmail: "privacy@clistesystems.ie",
  supportEmail: "support@clistesystems.ie",
  helloEmail: "hello@clistesystems.ie",
} as const;

export function companyRegistrationLine(): string {
  const parts = [
    `${CLISTE_COMPANY.legalName}, registered in ${CLISTE_COMPANY.jurisdiction}`,
  ];
  if (CLISTE_COMPANY.croNumber) {
    parts.push(`CRO ${CLISTE_COMPANY.croNumber}`);
  }
  parts.push(`Registered office: ${CLISTE_COMPANY.registeredOffice}`);
  return parts.join(" · ");
}
