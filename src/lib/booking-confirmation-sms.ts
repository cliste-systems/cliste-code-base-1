import twilio from "twilio";

/** Best-effort outbound SMS (Action Inbox alerts, etc.). */
export async function sendTwilioBookingSms(
  to: string,
  body: string,
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
    await client.messages.create({ from, to: to.trim(), body });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
