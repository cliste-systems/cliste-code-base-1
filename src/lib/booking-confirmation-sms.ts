import twilio from "twilio";

import { getReminderTimezone } from "@/lib/appointment-reminder-sms";

export function buildBookingConfirmationSmsBody(input: {
  customerName: string;
  salonName: string;
  serviceName: string;
  startTimeIso: string;
  bookingReference: string;
}): string {
  const first = input.customerName.trim().split(/\s+/)[0] || "there";
  const tz = getReminderTimezone();
  const start = new Date(input.startTimeIso);
  let when: string;
  try {
    when = start.toLocaleString("en-IE", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    when = start.toLocaleString("en-IE", { hour12: true });
  }
  const ref = input.bookingReference.trim();
  return `Hi ${first}, your booking at ${input.salonName} is confirmed: ${input.serviceName} on ${when}. Ref: ${ref}. To change or cancel, call this number and quote your reference. — ${input.salonName}`;
}

/** Customer-facing SMS after the salon cancels their confirmed visit (dashboard or Cara). */
export function buildBookingCancellationSmsBody(input: {
  customerName: string;
  salonName: string;
  serviceName: string;
  /** Already formatted in the salon timezone, e.g. "Wed 16 Apr, 2:30 pm". */
  whenLabel: string;
  bookingReference: string;
}): string {
  const first = input.customerName.trim().split(/\s+/)[0] || "there";
  const ref = input.bookingReference.trim();
  const refPart = ref ? ` Ref: ${ref}.` : "";
  return `Hi ${first}, your appointment at ${input.salonName} for ${input.serviceName} on ${input.whenLabel} has been cancelled.${refPart} Reply or call us anytime to rebook. — ${input.salonName}`;
}

export async function sendPublicBookingOtpSms(
  to: string,
  code: string,
  salonName: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const first = salonName.trim() || "Salon";
  const body = `Your ${first} booking code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`;
  return sendTwilioBookingSms(to, body);
}

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
