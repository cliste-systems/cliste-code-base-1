import twilio from "twilio";

/**
 * Public booking OTP via Twilio Verify (recommended for production).
 *
 * Env (all required to enable this path instead of custom DB OTP + SMS):
 * - `TWILIO_ACCOUNT_SID`
 * - `TWILIO_AUTH_TOKEN`
 * - `TWILIO_VERIFY_SERVICE_SID` — Verify service SID (starts with `VA…`)
 *
 * Create a Verify service in Twilio Console → Verify → Services, enable SMS,
 * set code length to match the UI (6 digits).
 *
 * One Verify service is shared across all salons; codes are keyed by phone number
 * only (Twilio’s model), which matches a single Cliste deployment.
 */

export function isTwilioVerifyConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_VERIFY_SERVICE_SID?.trim(),
  );
}

function twilioVerifyClient(): {
  client: ReturnType<typeof twilio>;
  serviceSid: string;
} {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!.trim();
  return { client: twilio(sid, token), serviceSid };
}

export async function startTwilioVerifyBookingSms(
  phoneE164: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { client, serviceSid } = twilioVerifyClient();
    await client.verify.v2.services(serviceSid).verifications.create({
      to: phoneE164.trim(),
      channel: "sms",
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Twilio Verify start failed", msg);
    return {
      ok: false,
      message:
        "Could not send a verification text right now. Check the number and try again, or contact the salon.",
    };
  }
}

export async function checkTwilioVerifyBookingCode(
  phoneE164: string,
  codeRaw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = codeRaw.trim();
  if (!/^\d{4,10}$/.test(trimmed)) {
    return {
      ok: false,
      message: "Enter the verification code from your text.",
    };
  }
  try {
    const { client, serviceSid } = twilioVerifyClient();
    const result = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: phoneE164.trim(),
        code: trimmed,
      });
    if (result.status === "approved") {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        "That code is not correct or has expired. Request a new code.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Twilio Verify check failed", msg);
    return {
      ok: false,
      message:
        "Could not verify that code. Request a new code and try again.",
    };
  }
}
