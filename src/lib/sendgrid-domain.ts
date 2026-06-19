const CLISTE_OUTBOUND_DOMAIN = "clistesystems.ie";

export type SendGridDomainStatus = {
  configured: boolean;
  domain: string;
  authenticated: boolean;
  valid: boolean;
  message: string;
};

/**
 * Check whether clistesystems.ie is domain-authenticated in SendGrid.
 * Domain auth allows per-org `{slug}@clistesystems.ie` senders without
 * verifying each address individually.
 */
export async function getSendGridDomainAuthStatus(): Promise<SendGridDomainStatus> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      domain: CLISTE_OUTBOUND_DOMAIN,
      authenticated: false,
      valid: false,
      message: "SENDGRID_API_KEY is not configured.",
    };
  }

  const apiBase =
    process.env.SENDGRID_API_URL?.trim().replace(/\/$/, "") ||
    "https://api.sendgrid.com";

  const res = await fetch(`${apiBase}/v3/whitelabel/domains`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { errors?: { message?: string }[] };
      if (Array.isArray(body.errors) && body.errors[0]?.message) {
        detail = body.errors.map((e) => e.message).join("; ");
      }
    } catch {
      /* ignore */
    }
    return {
      configured: true,
      domain: CLISTE_OUTBOUND_DOMAIN,
      authenticated: false,
      valid: false,
      message: `SendGrid domain lookup failed (${res.status}): ${detail}`,
    };
  }

  const domains = (await res.json()) as Array<{
    domain?: string;
    valid?: boolean;
  }>;

  const match = domains.find(
    (row) =>
      String(row.domain ?? "")
        .trim()
        .toLowerCase() === CLISTE_OUTBOUND_DOMAIN,
  );

  if (!match) {
    return {
      configured: true,
      domain: CLISTE_OUTBOUND_DOMAIN,
      authenticated: false,
      valid: false,
      message: `${CLISTE_OUTBOUND_DOMAIN} is not listed in SendGrid domain authentication.`,
    };
  }

  const valid = Boolean(match.valid);
  return {
    configured: true,
    domain: CLISTE_OUTBOUND_DOMAIN,
    authenticated: true,
    valid,
    message: valid
      ? `${CLISTE_OUTBOUND_DOMAIN} is domain-authenticated in SendGrid.`
      : `${CLISTE_OUTBOUND_DOMAIN} is registered in SendGrid but DNS validation is incomplete.`,
  };
}
