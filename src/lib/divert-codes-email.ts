import "server-only";

import {
  CANCEL_ALL_FORWARDING_CODE,
  forwardingCodesForMode,
  parseCallRoutingMode,
} from "@/lib/call-routing";
import { buildDivertCodesEmailBodies } from "@/lib/divert-codes-email-bodies";
import {
  inviteEmailLogoUrl,
} from "@/lib/invite-email";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

export type SendDivertCodesResult =
  | { ok: true }
  | { ok: false; message: string };

export async function sendDivertCodesEmail(params: {
  recipientEmail: string;
  recipientName?: string;
  businessName: string;
  clisteNumber: string;
  organizationId: string;
}): Promise<SendDivertCodesResult> {
  if (!isSendGridConfigured()) {
    return {
      ok: false,
      message: "SendGrid is not configured — cannot send divert codes email.",
    };
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("call_routing_mode")
    .eq("id", params.organizationId)
    .maybeSingle();

  const mode = parseCallRoutingMode(org?.call_routing_mode);
  const codes = forwardingCodesForMode(mode, params.clisteNumber);
  if (codes.length === 0) {
    return {
      ok: false,
      message:
        "No divert codes apply for the current routing mode (Cliste-number mode uses landline portal instructions).",
    };
  }

  const bodies = buildDivertCodesEmailBodies({
    recipientName: params.recipientName,
    businessName: params.businessName,
    clisteNumber: params.clisteNumber,
    codes,
    cancelCode: CANCEL_ALL_FORWARDING_CODE,
    logoUrl: inviteEmailLogoUrl(),
  });

  const sent = await sendTransactionalEmail({
    to: params.recipientEmail,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });

  if (!sent.ok) {
    return { ok: false, message: sent.message };
  }
  return { ok: true };
}
