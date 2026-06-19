/**
 * Caller-facing SMS content helpers.
 *
 * Legal posture: transactional service texts need no AI/privacy boilerplate in
 * the body (see docs/legal/GDPR-VOICE-AGENTS-IRELAND.md). A short business
 * name prefix aids identification and deliverability without legal blocks.
 */

export type FormatCallerSmsBodyInput = {
  businessName: string;
  body: string;
};

/** Prefix with business name when not already present at the start of the body. */
export function formatCallerSmsBody(input: FormatCallerSmsBodyInput): string {
  const businessName = input.businessName.trim();
  const body = input.body.trim();
  if (!body) return "";
  if (!businessName) return body;

  const normalizedName = businessName.toLowerCase();
  const normalizedBody = body.toLowerCase();
  if (
    normalizedBody.startsWith(`${normalizedName}:`) ||
    normalizedBody.startsWith(`${normalizedName} -`) ||
    normalizedBody.startsWith(normalizedName)
  ) {
    return body;
  }

  return `${businessName}: ${body}`;
}
