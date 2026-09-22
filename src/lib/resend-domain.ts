import { Resend } from "resend";

import { OUTBOUND_EMAIL_DOMAIN } from "@/lib/company-details";

const CLISTE_OUTBOUND_DOMAIN = OUTBOUND_EMAIL_DOMAIN;

export type ResendDomainStatus = {
  configured: boolean;
  domain: string;
  authenticated: boolean;
  valid: boolean;
  message: string;
};

/**
 * Check whether hellocara.ie is verified in Resend.
 * Verified domains allow per-org `{slug}@hellocara.ie` senders without
 * pre-creating each address.
 */
export async function getResendDomainAuthStatus(): Promise<ResendDomainStatus> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      domain: CLISTE_OUTBOUND_DOMAIN,
      authenticated: false,
      valid: false,
      message: "RESEND_API_KEY is not configured.",
    };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.domains.list();

  if (error) {
    return {
      configured: true,
      domain: CLISTE_OUTBOUND_DOMAIN,
      authenticated: false,
      valid: false,
      message: `Resend domain lookup failed: ${error.message}`,
    };
  }

  const match = (data?.data ?? []).find(
    (row) =>
      String(row.name ?? "")
        .trim()
        .toLowerCase() === CLISTE_OUTBOUND_DOMAIN,
  );

  if (!match) {
    return {
      configured: true,
      domain: CLISTE_OUTBOUND_DOMAIN,
      authenticated: false,
      valid: false,
      message: `${CLISTE_OUTBOUND_DOMAIN} is not listed in Resend domains.`,
    };
  }

  const valid = match.status === "verified";
  return {
    configured: true,
    domain: CLISTE_OUTBOUND_DOMAIN,
    authenticated: true,
    valid,
    message: valid
      ? `${CLISTE_OUTBOUND_DOMAIN} is verified in Resend.`
      : `${CLISTE_OUTBOUND_DOMAIN} is registered in Resend but DNS verification is incomplete (${match.status}).`,
  };
}
