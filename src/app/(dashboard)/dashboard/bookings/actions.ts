"use server";

import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";

import { parseBusinessHoursFromDb } from "@/app/(dashboard)/dashboard/settings/business-hours";
import {
  computeAvailableBookingSlots,
  getSalonTimeZone,
  type DashboardBookingSlot,
} from "@/lib/booking-available-slots";
import { sendAppointmentCancellationSms } from "@/lib/appointment-cancellation-sms";
import { sendAppointmentCancellationEmailBestEffort } from "@/lib/booking-transactional-email";
import { appendCaraDiaryNoticeForDashboardUser } from "@/lib/cara-chat-persistence";
import { cancelConfirmedAppointmentForOrganization } from "@/lib/dashboard-appointment-cancel";
import {
  createDashboardAppointment,
  fetchBusyIntervalsForCalendarDayForOrg,
  type CreateAppointmentResult,
} from "@/lib/dashboard-appointment-create";
import { requireDashboardSession } from "@/lib/dashboard-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type GetDashboardBookingSlotsResult =
  | { ok: true; slots: DashboardBookingSlot[]; timeZone: string }
  | { ok: false; message: string };

/** Slots for manual booking UI: business hours minus existing bookings. */
export async function getDashboardBookingSlots(payload: {
  dateYmd: string;
  serviceId: string;
}): Promise<GetDashboardBookingSlotsResult> {
  const dateYmd = payload.dateYmd.trim();
  const serviceId = payload.serviceId.trim();

  if (!DATE_YMD_RE.test(dateYmd)) {
    return { ok: false, message: "Invalid date." };
  }
  if (!UUID_RE.test(serviceId)) {
    return { ok: false, message: "Invalid service." };
  }

  const { supabase, organizationId } = await requireDashboardSession();
  const tz = getSalonTimeZone();

  const [{ data: orgRow }, { data: svc, error: svcError }] = await Promise.all([
    supabase
      .from("organizations")
      .select("business_hours")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (svcError || !svc) {
    return {
      ok: false,
      message: svcError?.message ?? "Service not found for this salon.",
    };
  }

  const schedule = parseBusinessHoursFromDb(orgRow?.business_hours);
  const { busy, error: busyErr } = await fetchBusyIntervalsForCalendarDayForOrg(
    supabase,
    organizationId,
    dateYmd,
    tz,
  );
  if (busyErr) {
    return { ok: false, message: busyErr };
  }

  const slots = computeAvailableBookingSlots({
    dateYmd,
    durationMinutes: svc.duration_minutes,
    weekSchedule: schedule,
    busy,
    now: new Date(),
    timeZone: tz,
  });

  return { ok: true, slots, timeZone: tz };
}

export type { CreateAppointmentResult };

export async function createAppointment(payload: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceId: string;
  /** ISO 8601 start instant (client sends local wall time as ISO). */
  startTimeIso: string;
}): Promise<CreateAppointmentResult> {
  const { supabase, organizationId, user } = await requireDashboardSession();
  return createDashboardAppointment({
    supabase,
    organizationId,
    userId: user.id,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerEmail: payload.customerEmail,
    serviceId: payload.serviceId,
    startTimeIso: payload.startTimeIso,
    diaryOrigin: "bookings",
  });
}

export type CancelAppointmentResult =
  | { ok: true }
  | { ok: false; message: string };

export async function cancelAppointment(
  appointmentId: string
): Promise<CancelAppointmentResult> {
  const { supabase, organizationId, user } = await requireDashboardSession();
  const id = appointmentId.trim();
  const { data: apptRow } = await supabase
    .from("appointments")
    .select("customer_name, start_time, status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!apptRow) {
    return { ok: false, message: "Appointment not found." };
  }
  if (apptRow.status === "cancelled") {
    return { ok: true };
  }

  const result = await cancelConfirmedAppointmentForOrganization(
    supabase,
    organizationId,
    appointmentId,
  );
  if (!result.ok) return result;

  if (result.didPerformCancellation) {
    const sms = await sendAppointmentCancellationSms(
      supabase,
      organizationId,
      id,
    );
    if (!sms.sent && sms.reason === "twilio_error") {
      console.warn("Cancellation SMS failed", id, sms.message);
    }
    await sendAppointmentCancellationEmailBestEffort(
      supabase,
      organizationId,
      id,
    );
  }

  const tz = getSalonTimeZone();
  const who = apptRow?.customer_name
    ? String(apptRow.customer_name)
    : "Guest";
  const whenLabel =
    apptRow?.start_time && !Number.isNaN(new Date(String(apptRow.start_time)).getTime())
      ? formatInTimeZone(
          new Date(String(apptRow.start_time)),
          tz,
          "EEE d MMM, h:mm a",
        )
      : "that slot";
  await appendCaraDiaryNoticeForDashboardUser(
    supabase,
    organizationId,
    user.id,
    `From Bookings: cancelled ${who} (${whenLabel}). Your diary is updated.`,
  );

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type BookingCallContext =
  | {
      id: string;
      created_at: string;
      caller_number: string;
      duration_seconds: number;
      outcome: string;
      transcript: string | null;
      transcript_review: string | null;
      ai_summary: string | null;
    }
  | null;

export type GetBookingCallContextResult =
  | { ok: true; call: BookingCallContext }
  | { ok: false; message: string };

/**
 * Loads the linked call log for an appointment (transcript / summary for the booking detail UI).
 */
export async function getBookingCallContext(
  appointmentId: string,
): Promise<GetBookingCallContextResult> {
  const id = appointmentId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid appointment id." };
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select("call_log_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (apptErr) {
    return { ok: false, message: apptErr.message };
  }
  if (!appt) {
    return { ok: false, message: "Appointment not found." };
  }

  const callLogId = appt.call_log_id as string | null;
  if (!callLogId) {
    return { ok: true, call: null };
  }

  const { data: call, error: callErr } = await supabase
    .from("call_logs")
    .select(
      "id, created_at, caller_number, duration_seconds, outcome, transcript, transcript_review, ai_summary",
    )
    .eq("id", callLogId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (callErr) {
    return { ok: false, message: callErr.message };
  }

  return { ok: true, call: call ?? null };
}
