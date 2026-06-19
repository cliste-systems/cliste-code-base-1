import "server-only";

import { CLISTE_COMPANY } from "@/lib/company-details";

export type {
  OrgSenderEmail,
  OrgSenderEmailInput,
} from "./org-sender-email.data";

export {
  CLISTE_OUTBOUND_EMAIL_DOMAIN,
  resolveOrgSenderEmail,
  sanitizeOrgEmailLocalPart,
} from "./org-sender-email.data";

/** Platform-wide sender for signup, invites, and system notices. */
export function resolvePlatformSenderEmail(): {
  email: string;
  name: string;
} {
  return {
    email:
      process.env.SENDGRID_FROM_EMAIL?.trim() ||
      CLISTE_COMPANY.helloEmail,
    name: process.env.SENDGRID_FROM_NAME?.trim() || "Cliste",
  };
}
