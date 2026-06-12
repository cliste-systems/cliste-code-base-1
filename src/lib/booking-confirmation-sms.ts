import twilio from "twilio";

export type TwilioSmsSendOptions = {
  /** Billable org for SMS metering (optional). */
  organizationId?: string;
  purpose?: string;
};

/** Best-effort outbound SMS (Action Inbox alerts, link delivery, etc.). */
export async function sendTwilioBookingSms(
  to: string,
  body: string,
  options?: TwilioSmsSendOptions,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from =
    process.env.TWILIO_SMS_FROM?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!sid || !token || !from) {
    return { ok: false, message: "Twilio not configured" };
  }
  try {
    const client = twilio(sid, token);
    const message = await client.messages.create({ from, to: to.trim(), body });
    const segments = Math.max(
      1,
      Number(message.numSegments) || estimateSmsSegments(body),
    );
    if (options?.organizationId) {
      void recordSmsUsageAfterSend(
        options.organizationId,
        segments,
        options.purpose,
      );
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

function estimateSmsSegments(body: string): number {
  const len = body.length;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

async function recordSmsUsageAfterSend(
  organizationId: string,
  segments: number,
  purpose?: string,
): Promise<void> {
  try {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const { recordSmsUsage } = await import("@/lib/sms-usage");
    const admin = createAdminClient();
    await recordSmsUsage(admin, organizationId, { segments, purpose });
  } catch (err) {
    console.error(
      "[sms] usage record failed",
      organizationId,
      err instanceof Error ? err.message : err,
    );
  }
}
