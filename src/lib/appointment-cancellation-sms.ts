import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";

import { getSalonTimeZone } from "@/lib/booking-available-slots";
import {
  buildBookingCancellationSmsBody,
  sendTwilioBookingSms,
} from "@/lib/booking-confirmation-sms";
import {
  isPlausibleCustomerPhoneE164,
  normalizeCustomerPhoneE164,
} from "@/lib/booking-reference";

export type AppointmentCancellationSmsResult =
  | { sent: true }
  | {
      sent: false;
      reason: "no_phone" | "invalid_phone" | "twilio_error" | "load_error";
      message?: string;
    };

/**
 * Texts the customer after their visit was cancelled in Cliste (Bookings or Cara).
 * Best-effort: Twilio misconfig or invalid number does not throw.
 */
export async function sendAppointmentCancellationSms(
  supabase: SupabaseClient,
  organizationId: string,
  appointmentId: string,
): Promise<AppointmentCancellationSmsResult> {
  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select("customer_phone, customer_name, start_time, booking_reference, service_id")
    .eq("id", appointmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (apptErr || !appt) {
    return {
      sent: false,
      reason: "load_error",
      message: apptErr?.message,
    };
  }

  const rawPhone = String(appt.customer_phone ?? "").trim();
  if (!rawPhone) {
    return { sent: false, reason: "no_phone" };
  }

  const phoneE164 = normalizeCustomerPhoneE164(rawPhone);
  if (!isPlausibleCustomerPhoneE164(phoneE164)) {
    return { sent: false, reason: "invalid_phone" };
  }

  const serviceId = String(appt.service_id ?? "");
  const [{ data: org }, { data: svc }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("services")
      .select("name")
      .eq("id", serviceId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const salonName = org?.name?.trim() || "Salon";
  const serviceName =
    typeof svc?.name === "string" && svc.name.trim()
      ? svc.name.trim()
      : "Appointment";

  const tz = getSalonTimeZone();
  const start = new Date(String(appt.start_time));
  const whenLabel = Number.isNaN(start.getTime())
    ? "your booked time"
    : formatInTimeZone(start, tz, "EEE d MMM, h:mm a");

  const ref =
    typeof appt.booking_reference === "string" ? appt.booking_reference : "";

  const body = buildBookingCancellationSmsBody({
    customerName: String(appt.customer_name ?? "Guest"),
    salonName,
    serviceName,
    whenLabel,
    bookingReference: ref,
  });

  const sms = await sendTwilioBookingSms(phoneE164, body);
  if (!sms.ok) {
    return { sent: false, reason: "twilio_error", message: sms.message };
  }
  return { sent: true };
}
