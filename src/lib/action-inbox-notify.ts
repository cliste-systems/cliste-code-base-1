import type { SupabaseClient } from "@supabase/supabase-js";

import { formatE164ForDisplay } from "@/lib/call-history-types";
import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { sendTwilioBookingSms } from "@/lib/booking-confirmation-sms";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";

type NotifyInput = {
  summary: string;
  callerNumber: string;
  callerName?: string | null;
};

/**
 * SMS + email when a new Action Inbox item needs the owner. Best-effort:
 * failures are logged but must not fail the voice webhook.
 */
export async function notifyActionInboxOwner(
  admin: SupabaseClient,
  organizationId: string,
  input: NotifyInput,
): Promise<void> {
  const { data: org, error } = await admin
    .from("organizations")
    .select("name, notification_email, notification_phone")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !org) {
    console.error("[action-inbox-notify] org lookup", error?.message);
    return;
  }

  const email = String(org.notification_email ?? "").trim();
  const phone = String(org.notification_phone ?? "").trim();
  if (!email && !phone) {
    console.warn(
      "[action-inbox-notify] skipped — no notification_email or notification_phone",
      organizationId,
    );
    return;
  }

  const biz = String(org.name ?? "").trim() || "Your business";
  const caller =
    input.callerName?.trim() ||
    formatE164ForDisplay(input.callerNumber) ||
    input.callerNumber;
  const summary =
    input.summary.trim().slice(0, 500) || "A caller needs follow-up.";
  const origin = resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
  const inboxUrl = `${origin}/dashboard/action-inbox`;

  if (email && isSendGridConfigured()) {
    const res = await sendTransactionalEmail({
      to: email,
      subject: `${biz} — new Action Inbox item`,
      text: [
        `A caller needs your attention at ${biz}.`,
        "",
        `Caller: ${caller}`,
        "",
        summary,
        "",
        `Open Action Inbox: ${inboxUrl}`,
      ].join("\n"),
    });
    if (!res.ok) {
      console.error("[action-inbox-notify] email failed", res.message);
    }
  }

  if (phone) {
    const sms = `${biz}: new Action Inbox item from ${caller}. Open Cliste to review.`;
    const res = await sendTwilioBookingSms(phone, sms, {
      organizationId,
      purpose: "action_inbox_notify",
    });
    if (!res.ok) {
      console.error("[action-inbox-notify] sms failed", res.message);
    }
  }
}
