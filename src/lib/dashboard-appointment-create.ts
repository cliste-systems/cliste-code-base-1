import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";

import { parseBusinessHoursFromDb } from "@/app/(dashboard)/dashboard/settings/business-hours";
import {
  buildBookingConfirmationSmsBody,
  sendTwilioBookingSms,
} from "@/lib/booking-confirmation-sms";
import {
  computeAvailableBookingSlots,
  getCalendarDayUtcRange,
  getSalonTimeZone,
  isStartInSlotList,
  type BusyInterval,
} from "@/lib/booking-available-slots";
import {
  generateBookingReference,
  isPlausibleCustomerPhoneE164,
  normalizeCustomerPhoneE164,
} from "@/lib/booking-reference";
import {
  APPOINTMENT_OVERLAP_MESSAGE,
  hasConfirmedAppointmentOverlap,
  isDatabaseOverlapConstraintError,
} from "@/lib/appointments-overlap";
import { appendCaraDiaryNoticeForDashboardUser } from "@/lib/cara-chat-persistence";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreateAppointmentResult =
  | { ok: true; confirmationSmsFailed?: string }
  | { ok: false; message: string };

export async function fetchBusyIntervalsForCalendarDayForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  dateYmd: string,
  tz: string,
): Promise<{ busy: BusyInterval[]; error: string | null }> {
  const { startUtc, endExclusiveUtc } = getCalendarDayUtcRange(dateYmd, tz);
  const { data, error } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .lt("start_time", endExclusiveUtc.toISOString())
    .gt("end_time", startUtc.toISOString());

  if (error) {
    return { busy: [], error: error.message };
  }

  const busy: BusyInterval[] = (data ?? []).map((r) => ({
    start: new Date(String(r.start_time)),
    end: new Date(String(r.end_time)),
  }));
  return { busy, error: null };
}

/**
 * Same rules as the Bookings “Add booking” server action, for reuse from Cara chat.
 */
export async function createDashboardAppointment(params: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  startTimeIso: string;
  diaryOrigin?: "bookings" | "cara";
}): Promise<CreateAppointmentResult> {
  const name = params.customerName.trim();
  const phone = params.customerPhone.trim();
  const serviceId = params.serviceId.trim();
  const diaryOrigin = params.diaryOrigin ?? "bookings";

  if (!name) {
    return { ok: false, message: "Customer name is required." };
  }
  if (!phone) {
    return { ok: false, message: "Phone number is required." };
  }
  if (!UUID_RE.test(serviceId)) {
    return { ok: false, message: "Choose a service." };
  }

  const start = new Date(params.startTimeIso);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, message: "Invalid date or time." };
  }

  const { supabase, organizationId, userId } = params;

  const [{ data: orgRow, error: orgErr }, { data: svc, error: svcError }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, business_hours")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("services")
        .select("id, name, duration_minutes")
        .eq("id", serviceId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

  if (orgErr) {
    return { ok: false, message: orgErr.message };
  }
  if (svcError || !svc) {
    return {
      ok: false,
      message: svcError?.message ?? "Service not found for this salon.",
    };
  }

  const end = new Date(start.getTime() + svc.duration_minutes * 60_000);

  const tz = getSalonTimeZone();
  const dateYmd = formatInTimeZone(start, tz, "yyyy-MM-dd");
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

  if (!isStartInSlotList(start, slots)) {
    return {
      ok: false,
      message:
        "That time is outside opening hours, already booked, or not available. Pick a time from the list.",
    };
  }

  const { overlap, error: overlapCheckErr } =
    await hasConfirmedAppointmentOverlap(
      supabase,
      organizationId,
      start,
      end,
    );
  if (overlapCheckErr) {
    return { ok: false, message: overlapCheckErr };
  }
  if (overlap) {
    return { ok: false, message: APPOINTMENT_OVERLAP_MESSAGE };
  }

  const phoneE164 = normalizeCustomerPhoneE164(phone);
  if (!isPlausibleCustomerPhoneE164(phoneE164)) {
    return {
      ok: false,
      message:
        "Enter a full mobile number with country code (e.g. +353 87 123 4567).",
    };
  }

  let insertedId: string | null = null;
  let bookingRef: string | null = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const ref = generateBookingReference();
    const { data: row, error: insError } = await supabase
      .from("appointments")
      .insert({
        organization_id: organizationId,
        customer_name: name,
        customer_phone: phoneE164,
        service_id: serviceId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        source: "dashboard",
        booking_reference: ref,
      })
      .select("id")
      .single();

    if (!insError && row?.id) {
      insertedId = row.id as string;
      bookingRef = ref;
      break;
    }
    const msg = insError?.message ?? "";
    if (msg.includes("booking_reference") || msg.includes("23505")) {
      continue;
    }
    return {
      ok: false,
      message: isDatabaseOverlapConstraintError(msg)
        ? APPOINTMENT_OVERLAP_MESSAGE
        : msg,
    };
  }

  if (!insertedId || !bookingRef) {
    return {
      ok: false,
      message: "Could not save the booking. Please try again.",
    };
  }

  const salonName = orgRow?.name?.trim() || "Salon";
  const body = buildBookingConfirmationSmsBody({
    customerName: name,
    salonName,
    serviceName: typeof svc.name === "string" ? svc.name : "Appointment",
    startTimeIso: start.toISOString(),
    bookingReference: bookingRef,
  });

  const sms = await sendTwilioBookingSms(phoneE164, body);
  const svcLabel =
    typeof svc.name === "string" ? svc.name : "Appointment";
  const whenLabel = formatInTimeZone(start, tz, "EEE d MMM, h:mm a");
  const diaryBody =
    diaryOrigin === "cara"
      ? `From Cara: booked ${name} — ${svcLabel} on ${whenLabel}.`
      : `From Bookings: new confirmed visit for ${name} — ${svcLabel} on ${whenLabel}.`;
  await appendCaraDiaryNoticeForDashboardUser(
    supabase,
    organizationId,
    userId,
    diaryBody,
  );

  if (sms.ok) {
    await supabase
      .from("appointments")
      .update({ confirmation_sms_sent_at: new Date().toISOString() })
      .eq("id", insertedId)
      .eq("organization_id", organizationId);
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
    return { ok: true };
  }

  const smsFailedReason =
    sms.message === "Twilio not configured"
      ? "SMS is not configured (add Twilio credentials to this environment)."
      : sms.message;

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true, confirmationSmsFailed: smsFailedReason };
}
