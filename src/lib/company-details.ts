/** Cliste Systems Limited company details for public legal documents. */

export const PRODUCT_NAME = "Hello Cara";

export const MARKETING_SITE_URL = "https://hellocara.ie";

/** Production app host when `NEXT_PUBLIC_APP_URL` is unset (local scripts, fallbacks). */
export const DEFAULT_APP_SITE_URL = "https://app.hellocara.ie";

export const OUTBOUND_EMAIL_DOMAIN = "hellocara.ie";

export const CLISTE_COMPANY = {
  legalName: "Cliste Systems Limited",
  productName: PRODUCT_NAME,
  jurisdiction: "Ireland",
  marketingSiteUrl: MARKETING_SITE_URL,
  appSiteUrl: DEFAULT_APP_SITE_URL,
  outboundEmailDomain: OUTBOUND_EMAIL_DOMAIN,
  /** Set CLISTE_CRO_NUMBER in production env for public display. */
  croNumber: process.env.CLISTE_CRO_NUMBER?.trim() || null,
  /** Set CLISTE_REGISTERED_OFFICE in production env for public display. */
  registeredOffice:
    process.env.CLISTE_REGISTERED_OFFICE?.trim() || "Dublin, Ireland",
  privacyEmail: "privacy@hellocara.ie",
  supportEmail: "support@hellocara.ie",
  helloEmail: "hello@hellocara.ie",
  securityEmail: "security@hellocara.ie",
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
