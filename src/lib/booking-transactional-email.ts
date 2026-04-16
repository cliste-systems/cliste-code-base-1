import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";

import { getSalonTimeZone } from "@/lib/booking-available-slots";
import { reminderSmsBody } from "@/lib/appointment-reminder-sms";
import {
  buildBookingConfirmationSmsBody,
  buildBookingCancellationSmsBody,
} from "@/lib/booking-confirmation-sms";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns lowercased email or null if empty / invalid. */
export function normalizeOptionalCustomerEmail(raw: unknown): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s.length > 254) return null;
  if (!EMAIL_RE.test(s)) return null;
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBookingConfirmationEmailBodies(input: {
  customerName: string;
  salonName: string;
  serviceName: string;
  startTimeIso: string;
  bookingReference: string;
}): { subject: string; text: string; html: string } {
  const text = buildBookingConfirmationSmsBody(input);
  const subject = `Booking confirmed — ${input.salonName.trim() || "Salon"}`;
  const safe = {
    name: escapeHtml(input.customerName.trim()),
    salon: escapeHtml(input.salonName.trim() || "Salon"),
    service: escapeHtml(input.serviceName.trim() || "Appointment"),
    ref: escapeHtml(input.bookingReference.trim()),
    textBody: escapeHtml(text),
  };
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p>Hi ${safe.name.split(/\s+/)[0] || "there"},</p>
<p>Your booking at <strong>${safe.salon}</strong> is confirmed.</p>
<ul>
<li><strong>Service:</strong> ${safe.service}</li>
<li><strong>Reference:</strong> ${safe.ref}</li>
</ul>
<p style="white-space:pre-wrap">${safe.textBody}</p>
<p>— ${safe.salon}</p>
</body></html>`;
  return { subject, text, html };
}

export function buildBookingCancellationEmailBodies(input: {
  customerName: string;
  salonName: string;
  serviceName: string;
  whenLabel: string;
  bookingReference: string;
}): { subject: string; text: string; html: string } {
  const text = buildBookingCancellationSmsBody(input);
  const subject = `Appointment cancelled — ${input.salonName.trim() || "Salon"}`;
  const safe = {
    name: escapeHtml(input.customerName.trim()),
    salon: escapeHtml(input.salonName.trim() || "Salon"),
    service: escapeHtml(input.serviceName.trim() || "Appointment"),
    when: escapeHtml(input.whenLabel),
    textBody: escapeHtml(text),
  };
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p>Hi ${safe.name.split(/\s+/)[0] || "there"},</p>
<p>Your appointment at <strong>${safe.salon}</strong> for <strong>${safe.service}</strong> on <strong>${safe.when}</strong> has been cancelled.</p>
<p style="white-space:pre-wrap">${safe.textBody}</p>
<p>— ${safe.salon}</p>
</body></html>`;
  return { subject, text, html };
}

export function buildAppointmentReminderEmailBodies(input: {
  customerName: string;
  salonName: string;
  serviceName: string;
  startTimeIso: string;
  bookingReference?: string | null;
}): { subject: string; text: string; html: string } {
  const text = reminderSmsBody(input);
  const subject = `Reminder: ${input.serviceName.trim() || "Appointment"} at ${input.salonName.trim() || "Salon"}`;
  const safe = {
    textBody: escapeHtml(text),
    salon: escapeHtml(input.salonName.trim() || "Salon"),
  };
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p style="white-space:pre-wrap">${safe.textBody}</p>
<p>— ${safe.salon}</p>
</body></html>`;
  return { subject, text, html };
}

export async function sendAppointmentCancellationEmailBestEffort(
  supabase: SupabaseClient,
  organizationId: string,
  appointmentId: string,
): Promise<void> {
  if (!isSendGridConfigured()) return;

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "customer_email, customer_name, start_time, booking_reference, service_id",
    )
    .eq("id", appointmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (apptErr || !appt) return;

  const to = normalizeOptionalCustomerEmail(
    (appt as { customer_email?: string | null }).customer_email,
  );
  if (!to) return;

  const serviceId = String((appt as { service_id?: string }).service_id ?? "");
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
  const start = new Date(String((appt as { start_time: string }).start_time));
  const whenLabel = Number.isNaN(start.getTime())
    ? "your booked time"
    : formatInTimeZone(start, tz, "EEE d MMM, h:mm a");

  const ref =
    typeof (appt as { booking_reference?: string }).booking_reference ===
    "string"
      ? (appt as { booking_reference: string }).booking_reference
      : "";

  const bodies = buildBookingCancellationEmailBodies({
    customerName: String((appt as { customer_name?: string }).customer_name ?? "Guest"),
    salonName,
    serviceName,
    whenLabel,
    bookingReference: ref,
  });

  const res = await sendTransactionalEmail({
    to,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });
  if (!res.ok) {
    console.warn(
      "Cancellation email failed",
      appointmentId,
      res.message,
    );
  }
}
