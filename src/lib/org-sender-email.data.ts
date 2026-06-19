/** Outbound mail domain for per-business Cara / owner notification senders. */
export const CLISTE_OUTBOUND_EMAIL_DOMAIN = "clistesystems.ie";

const RESERVED_LOCAL_PARTS = new Set([
  "admin",
  "brendan",
  "cara",
  "dmarc",
  "hello",
  "hostmaster",
  "noreply",
  "no-reply",
  "postmaster",
  "privacy",
  "security",
  "support",
  "webmaster",
]);

export type OrgSenderEmailInput = {
  name: string | null;
  slug: string | null;
  notificationEmail?: string | null;
};

export type OrgSenderEmail = {
  email: string;
  name: string;
  replyTo: string | null;
};

/** Sanitize an org slug into a safe email local-part. */
export function sanitizeOrgEmailLocalPart(slug: string): string | null {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  if (!normalized || normalized.length < 2) return null;
  if (RESERVED_LOCAL_PARTS.has(normalized)) return null;
  return normalized;
}

/**
 * Per-business From address: `{slug}@clistesystems.ie` with display name from
 * org name. Reply-To routes to the business notification inbox when set.
 */
export function resolveOrgSenderEmail(
  input: OrgSenderEmailInput,
): OrgSenderEmail | null {
  const slug = String(input.slug ?? "").trim();
  const localPart = sanitizeOrgEmailLocalPart(slug);
  if (!localPart) return null;

  const displayName =
    String(input.name ?? "").trim() || slug.replace(/-/g, " ") || "Cliste";
  const replyTo = String(input.notificationEmail ?? "").trim() || null;

  return {
    email: `${localPart}@${CLISTE_OUTBOUND_EMAIL_DOMAIN}`,
    name: displayName,
    replyTo,
  };
}
