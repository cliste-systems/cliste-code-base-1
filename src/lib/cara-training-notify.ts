import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { sendTwilioBookingSms } from "@/lib/booking-confirmation-sms";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";

/**
 * SMS + email when Cara needs owner input on the training page. Best-effort.
 */
export async function notifyCaraTrainingOwner(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    itemId: string;
    gapSummary: string;
  },
): Promise<void> {
  const { data: org, error } = await admin
    .from("organizations")
    .select("name, notification_email, notification_phone")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !org) {
    console.error("[cara-training-notify] org lookup", error?.message);
    return;
  }

  const email = String(org.notification_email ?? "").trim();
  const phone = String(org.notification_phone ?? "").trim();
  if (!email && !phone) {
    console.warn(
      "[cara-training-notify] skipped — no notification_email or notification_phone",
      organizationId,
    );
    return;
  }

  const biz = String(org.name ?? "").trim() || "Your business";
  const topic = input.gapSummary.trim().slice(0, 300) || "something on a recent call";
  const origin = resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
  const trainingUrl = `${origin}/dashboard/cara-training?item=${encodeURIComponent(input.itemId)}`;

  if (email && isSendGridConfigured()) {
    const res = await sendTransactionalEmail({
      to: email,
      subject: `${biz} — Cara needs training input`,
      text: [
        `Cara learned something on a call at ${biz} and needs your help.`,
        "",
        topic,
        "",
        `Open Cara Training: ${trainingUrl}`,
      ].join("\n"),
    });
    if (!res.ok) {
      console.error("[cara-training-notify] email failed", res.message);
    }
  }

  if (phone) {
    const sms = `${biz}: Cara needs training input — "${topic.slice(0, 80)}". Open Cliste to answer.`;
    const res = await sendTwilioBookingSms(phone, sms, {
      organizationId,
      purpose: "cara_training_notify",
    });
    if (!res.ok) {
      console.error("[cara-training-notify] sms failed", res.message);
    }
  }
}
