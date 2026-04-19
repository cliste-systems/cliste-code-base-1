"use server";

import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";

import { parseBusinessHoursFromDb } from "@/app/(dashboard)/dashboard/settings/business-hours";
import {
  computeAvailableBookingSlots,
  getSalonTimeZone,
  type DashboardBookingSlot,
} from "@/lib/booking-available-slots";
import {
  fetchStaffBusyIntervalsForDay,
  loadStaffDayWindowsFor,
} from "@/lib/staff-availability";
import { toZonedTime } from "date-fns-tz";
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
  /** Optional: filter to a single stylist's availability + busy schedule. */
  staffId?: string | null;
  /** Extra minutes added by selected add-ons; lengthens each slot. */
  extraDurationMinutes?: number | null;
}): Promise<GetDashboardBookingSlotsResult> {
  const dateYmd = payload.dateYmd.trim();
  const serviceId = payload.serviceId.trim();
  const staffId =
    typeof payload.staffId === "string" && UUID_RE.test(payload.staffId.trim())
      ? payload.staffId.trim()
      : null;

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

  // Optional per-staff overlay: working windows for that day, plus the
  // stylist's own busy list. When staffId is null we show the org-wide
  // bookable surface (sane default for "any stylist").
  let staffWindows: { startMin: number; endMin: number }[] | undefined;
  let staffBusy: { start: Date; end: Date }[] | undefined;
  if (staffId) {
    const dayDate = toZonedTime(`${dateYmd}T12:00:00Z`, tz);
    const weekday = dayDate.getDay();
    const w = await loadStaffDayWindowsFor(
      supabase,
      organizationId,
      staffId,
      dateYmd,
      tz,
      weekday,
    );
    if (w.error) return { ok: false, message: w.error };
    if (w.windows !== null) staffWindows = w.windows;

    const sb = await fetchStaffBusyIntervalsForDay(
      supabase,
      organizationId,
      staffId,
      dateYmd,
      tz,
    );
    if (sb.error) return { ok: false, message: sb.error };
    staffBusy = sb.busy;
  }

  const extra = Math.max(
    0,
    Math.min(
      480,
      Math.round(Number(payload.extraDurationMinutes ?? 0)) || 0,
    ),
  );

  const slots = computeAvailableBookingSlots({
    dateYmd,
    durationMinutes: svc.duration_minutes + extra,
    weekSchedule: schedule,
    busy,
    now: new Date(),
    timeZone: tz,
    staffWindows,
    staffBusy,
  });

  return { ok: true, slots, timeZone: tz };
}

export async function createAppointment(payload: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceId: string;
  /** ISO 8601 start instant (client sends local wall time as ISO). */
  startTimeIso: string;
  /** Optional assigned stylist (null = unassigned pool). */
  staffId?: string | null;
  /** Optional add-on UUIDs to attach as line items. */
  addonIds?: string[] | null;
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
    staffId: payload.staffId ?? null,
    diaryOrigin: "bookings",
    addonIds: payload.addonIds ?? null,
  });
}

/**
 * List service add-ons available for the dashboard's "Add booking" picker.
 * Returns add-ons that are either bound to `serviceId` or are global
 * (`service_id` is null). Inactive add-ons are excluded.
 */
export async function listAddonsForBookingService(payload: {
  serviceId: string;
}): Promise<
  | {
      ok: true;
      addons: Array<{
        id: string;
        name: string;
        priceCents: number;
        durationMinutes: number;
      }>;
    }
  | { ok: false; message: string }
> {
  const serviceId = (payload.serviceId ?? "").trim();
  if (!UUID_RE.test(serviceId)) {
    return { ok: false, message: "Invalid service id." };
  }
  const { supabase, organizationId } = await requireDashboardSession();
  const { data, error } = await supabase
    .from("service_addons")
    .select("id, name, price_cents, duration_minutes, service_id, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .or(`service_id.is.null,service_id.eq.${serviceId}`)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    addons: (data ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "Add-on",
      priceCents: Number(r.price_cents ?? 0),
      durationMinutes: Number(r.duration_minutes ?? 0),
    })),
  };
}

export type CreateRecurringSeriesResult =
  | {
      ok: true;
      seriesId: string;
      created: number;
      skipped: { startIso: string; reason: string }[];
    }
  | { ok: false; message: string };

/**
 * Create a recurring booking series (weekly / fortnightly / monthly).
 * The first occurrence sends SMS + email; subsequent ones are silent so the
 * customer doesn't get spammed with N near-identical confirmations. All rows
 * share a `series_id` so cancel-following / edit-following can find them.
 */
export async function createRecurringAppointmentSeries(payload: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceId: string;
  startTimeIso: string;
  staffId?: string | null;
  frequency: "weekly" | "fortnightly" | "monthly";
  /** Total occurrences including the first, 2..26. */
  count: number;
  untilIso?: string | null;
}): Promise<CreateRecurringSeriesResult> {
  const { supabase, organizationId, user } = await requireDashboardSession();

  const { planRecurringOccurrences } = await import(
    "@/lib/booking-recurrence"
  );

  let plan;
  try {
    plan = planRecurringOccurrences({
      startIso: payload.startTimeIso,
      frequency: payload.frequency,
      count: payload.count,
      untilIso: payload.untilIso ?? null,
    });
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not plan series.",
    };
  }

  if (plan.occurrences.length < 2) {
    return {
      ok: false,
      message: "Series needs at least 2 occurrences.",
    };
  }

  const seriesId = crypto.randomUUID();
  const skipped: { startIso: string; reason: string }[] = [];
  let created = 0;

  for (let i = 0; i < plan.occurrences.length; i++) {
    const startIso = plan.occurrences[i] as string;
    const res = await createDashboardAppointment({
      supabase,
      organizationId,
      userId: user.id,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      serviceId: payload.serviceId,
      startTimeIso: startIso,
      staffId: payload.staffId ?? null,
      diaryOrigin: "bookings",
      seriesId,
      recurrenceRule: plan.recurrenceRule,
      // First occurrence sends SMS/email; the rest are quiet so the customer
      // gets one confirmation describing the series, not 12 separate texts.
      silent: i > 0,
    });
    if (res.ok) {
      created += 1;
    } else {
      skipped.push({ startIso, reason: res.message });
    }
  }

  // Roll back if literally nothing landed (we couldn't even create the seed).
  if (created === 0) {
    return {
      ok: false,
      message:
        skipped[0]?.reason ?? "No appointments could be created for the series.",
    };
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");

  return { ok: true, seriesId, created, skipped };
}

export type CancelSeriesResult =
  | { ok: true; cancelled: number }
  | { ok: false; message: string };

/**
 * Cancel every confirmed appointment in a series whose start is at or after
 * `fromIso`. Used by the "cancel this and following" affordance.
 */
export async function cancelAppointmentSeriesFollowing(payload: {
  seriesId: string;
  fromIso: string;
  reason?: string | null;
}): Promise<CancelSeriesResult> {
  const seriesId = (payload.seriesId ?? "").trim();
  if (!UUID_RE.test(seriesId)) {
    return { ok: false, message: "Invalid series id." };
  }
  const fromDate = new Date(payload.fromIso);
  if (Number.isNaN(fromDate.getTime())) {
    return { ok: false, message: "Invalid from-date." };
  }

  const { supabase, organizationId, user } = await requireDashboardSession();

  const { data: rows, error: readErr } = await supabase
    .from("appointments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("series_id", seriesId)
    .eq("status", "confirmed")
    .gte("start_time", fromDate.toISOString());

  if (readErr) return { ok: false, message: readErr.message };
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { ok: true, cancelled: 0 };

  let cancelled = 0;
  for (const apptId of ids) {
    const res = await cancelConfirmedAppointmentForOrganization(
      supabase,
      organizationId,
      apptId,
      {
        reason: payload.reason ?? null,
        cancelledBy: user.id,
      },
    );
    if (res.ok) cancelled += 1;
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true, cancelled };
}

export type SetAppointmentStatusResult =
  | { ok: true }
  | { ok: false; message: string };

const ALLOWED_STATUS_TRANSITIONS = new Set([
  "confirmed",
  "completed",
  "no_show",
]);

/**
 * Move an appointment between non-cancelled statuses. Cancellation has its own
 * action (`cancelAppointment`) because it triggers SMS/email + diary notice.
 *
 * Allowed: confirmed <-> completed <-> no_show. Cancelled rows are read-only.
 */
export async function setAppointmentStatus(payload: {
  appointmentId: string;
  status: "confirmed" | "completed" | "no_show";
}): Promise<SetAppointmentStatusResult> {
  const id = payload.appointmentId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid appointment id." };
  }
  if (!ALLOWED_STATUS_TRANSITIONS.has(payload.status)) {
    return { ok: false, message: "Invalid status." };
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: row, error: readErr } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!row) return { ok: false, message: "Appointment not found." };
  if (row.status === "cancelled") {
    return {
      ok: false,
      message:
        "This booking is cancelled — re-create it instead of changing status.",
    };
  }
  if (row.status === payload.status) {
    return { ok: true };
  }

  const { error: updErr } = await supabase
    .from("appointments")
    .update({ status: payload.status })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (updErr) return { ok: false, message: updErr.message };

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type RescheduleAppointmentResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Move an existing confirmed booking to a new start time (and optionally a
 * different stylist). Re-uses the same overlap + working-hours rules as
 * createAppointment. Does NOT (yet) re-send SMS — that's a follow-up.
 */
export async function rescheduleAppointment(payload: {
  appointmentId: string;
  newStartIso: string;
  staffId?: string | null;
}): Promise<RescheduleAppointmentResult> {
  const id = payload.appointmentId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid appointment id." };
  }
  const newStart = new Date(payload.newStartIso);
  if (Number.isNaN(newStart.getTime())) {
    return { ok: false, message: "Invalid date or time." };
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: row, error: readErr } = await supabase
    .from("appointments")
    .select("status, start_time, end_time, service_id, staff_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!row) return { ok: false, message: "Appointment not found." };
  if (row.status !== "confirmed") {
    return {
      ok: false,
      message: "Only confirmed bookings can be rescheduled.",
    };
  }

  const durationMs =
    new Date(row.end_time as string).getTime() -
    new Date(row.start_time as string).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { ok: false, message: "Existing booking has invalid duration." };
  }
  const newEnd = new Date(newStart.getTime() + durationMs);
  const targetStaffId =
    payload.staffId === undefined
      ? (row.staff_id as string | null)
      : payload.staffId;

  // Conditional update: only succeeds if no overlap on the target staff
  // bucket. The exclusion constraint will reject if overlap exists.
  const { error: updErr } = await supabase
    .from("appointments")
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      staff_id: targetStaffId,
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "confirmed");
  if (updErr) {
    const m = updErr.message || "";
    if (
      m.includes("appointments_confirmed_no_overlap") ||
      m.includes("23P01")
    ) {
      return {
        ok: false,
        message: targetStaffId
          ? "That time clashes with another booking for this stylist."
          : "That time clashes with another unassigned booking. (Unassigned bookings share one pool — pick a stylist or a free slot.)",
      };
    }
    return { ok: false, message: m };
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

/**
 * Drag-resize handler: changes only the end_time on an appointment, keeping
 * start_time and stylist intact. Used by the bottom-edge resize handle on
 * the calendar appointment block.
 */
export async function resizeAppointment(payload: {
  appointmentId: string;
  newEndIso: string;
}): Promise<RescheduleAppointmentResult> {
  const id = payload.appointmentId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid appointment id." };
  }
  const newEnd = new Date(payload.newEndIso);
  if (Number.isNaN(newEnd.getTime())) {
    return { ok: false, message: "Invalid end time." };
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: row, error: readErr } = await supabase
    .from("appointments")
    .select("status, start_time, staff_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!row) return { ok: false, message: "Appointment not found." };
  if (row.status !== "confirmed") {
    return {
      ok: false,
      message: "Only confirmed bookings can be resized.",
    };
  }

  const start = new Date(row.start_time as string);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, message: "Existing booking has invalid start time." };
  }
  const minDurationMs = 5 * 60_000;
  if (newEnd.getTime() - start.getTime() < minDurationMs) {
    return { ok: false, message: "Booking must be at least 5 minutes long." };
  }
  const maxDurationMs = 8 * 60 * 60_000;
  if (newEnd.getTime() - start.getTime() > maxDurationMs) {
    return { ok: false, message: "Booking can be at most 8 hours long." };
  }

  const { error: updErr } = await supabase
    .from("appointments")
    .update({ end_time: newEnd.toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "confirmed");

  if (updErr) {
    const m = updErr.message || "";
    if (
      m.includes("appointments_confirmed_no_overlap") ||
      m.includes("23P01")
    ) {
      return {
        ok: false,
        message: row.staff_id
          ? "Resize would clash with another booking for this stylist."
          : "Resize would clash with another unassigned booking.",
      };
    }
    return { ok: false, message: m };
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export type CancelAppointmentResult =
  | { ok: true }
  | { ok: false; message: string };

export async function cancelAppointment(
  appointmentId: string,
  options?: { reason?: string | null },
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
    { reason: options?.reason ?? null, cancelledBy: user.id },
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
