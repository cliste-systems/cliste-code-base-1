import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";

import { parseBusinessHoursFromDb } from "@/app/(dashboard)/dashboard/settings/business-hours";
import {
  buildBookingConfirmationEmailBodies,
  normalizeOptionalCustomerEmail,
} from "@/lib/booking-transactional-email";
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
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreateAppointmentResult =
  | {
      ok: true;
      confirmationSmsFailed?: string;
      confirmationEmailFailed?: string;
    }
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
  /** Optional — confirmation email when SendGrid is configured. */
  customerEmail?: string | null;
  serviceId: string;
  startTimeIso: string;
  /** Optional staff id (null => unassigned pool). */
  staffId?: string | null;
  diaryOrigin?: "bookings" | "cara";
  /**
   * When set, the appointment row is stamped with this `series_id` and the
   * given `recurrence_rule` so it joins an existing recurring series.
   * Used by the "create recurring booking" flow to group instances.
   */
  seriesId?: string | null;
  recurrenceRule?: string | null;
  /**
   * If true, only insert the row + return; skip SMS, email, diary append,
   * and revalidatePath. Used when generating bulk follow-on instances of a
   * recurring series — only the first instance sends a confirmation.
   */
  silent?: boolean;
  /**
   * Optional service add-ons (UUIDs from `service_addons`) to attach as
   * line items. Their durations extend the appointment end_time and their
   * prices are summed alongside the primary service.
   */
  addonIds?: string[] | null;
}): Promise<CreateAppointmentResult & { appointmentId?: string }> {
  const name = params.customerName.trim();
  const phone = params.customerPhone.trim();
  const serviceId = params.serviceId.trim();
  const diaryOrigin = params.diaryOrigin ?? "bookings";
  const emailNorm = normalizeOptionalCustomerEmail(params.customerEmail);

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
        .select("id, name, duration_minutes, price")
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

  const cleanAddonIds = Array.from(
    new Set(
      (params.addonIds ?? [])
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => UUID_RE.test(v)),
    ),
  );

  let addons: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
  }> = [];
  if (cleanAddonIds.length > 0) {
    const { data: addonRows, error: addonErr } = await supabase
      .from("service_addons")
      .select("id, name, duration_minutes, price_cents, is_active, service_id")
      .eq("organization_id", organizationId)
      .in("id", cleanAddonIds);
    if (addonErr) {
      return { ok: false, message: addonErr.message };
    }
    addons = (addonRows ?? [])
      .filter(
        (r) =>
          r.is_active !== false &&
          (r.service_id === null || r.service_id === serviceId),
      )
      .map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? "Add-on",
        duration_minutes: Number(r.duration_minutes ?? 0),
        price_cents: Number(r.price_cents ?? 0),
      }));
  }

  const addonDuration = addons.reduce(
    (sum, a) => sum + (Number.isFinite(a.duration_minutes) ? a.duration_minutes : 0),
    0,
  );
  const totalDuration = svc.duration_minutes + addonDuration;
  const end = new Date(start.getTime() + totalDuration * 60_000);

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
    durationMinutes: totalDuration,
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

  const emailRaw = String(params.customerEmail ?? "").trim();
  if (emailRaw && !emailNorm) {
    return {
      ok: false,
      message: "That email address does not look valid.",
    };
  }

  // Upsert canonical client record so appointments.client_id is always
  // populated for new bookings (and the no-show / total-visits trigger
  // can do its job).
  let resolvedClientId: string | null = null;
  {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();

    if (existing?.id) {
      resolvedClientId = existing.id as string;
      // Best-effort: update name + email to the most-recent value the
      // client gave us. Ignore errors — this is purely a freshness pass.
      await supabase
        .from("clients")
        .update({
          name,
          email: emailNorm ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resolvedClientId)
        .eq("organization_id", organizationId);
    } else {
      const { data: created } = await supabase
        .from("clients")
        .insert({
          organization_id: organizationId,
          name,
          phone_e164: phoneE164,
          email: emailNorm ?? null,
        })
        .select("id")
        .maybeSingle();
      if (created?.id) resolvedClientId = created.id as string;
    }
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
        customer_email: emailNorm,
        service_id: serviceId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        source: "dashboard",
        booking_reference: ref,
        ...(params.staffId !== undefined ? { staff_id: params.staffId } : {}),
        ...(resolvedClientId ? { client_id: resolvedClientId } : {}),
        ...(params.seriesId ? { series_id: params.seriesId } : {}),
        ...(params.recurrenceRule
          ? { recurrence_rule: params.recurrenceRule }
          : {}),
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

  // Best-effort: write line items so the new multi-service UI has something
  // to display. The DB-level backfill covers legacy rows, but new rows go
  // through here. Failures don't roll the appointment back.
  try {
    const items: Array<Record<string, unknown>> = [
      {
        organization_id: organizationId,
        appointment_id: insertedId,
        service_id: serviceId,
        addon_id: null,
        staff_id: params.staffId ?? null,
        name: typeof svc.name === "string" ? svc.name : "Service",
        duration_minutes: svc.duration_minutes,
        price_cents: Math.round(Number(svc.price ?? 0) * 100),
        display_order: 0,
      },
    ];
    addons.forEach((a, idx) => {
      items.push({
        organization_id: organizationId,
        appointment_id: insertedId,
        service_id: serviceId,
        addon_id: a.id,
        staff_id: params.staffId ?? null,
        name: a.name,
        duration_minutes: a.duration_minutes,
        price_cents: a.price_cents,
        display_order: idx + 1,
      });
    });
    await supabase.from("appointment_items").insert(items);
  } catch {
    // ignore — items are decorative for now; primary service_id stays on row
  }

  if (params.silent) {
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
    return { ok: true, appointmentId: insertedId };
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

  let confirmationEmailFailed: string | undefined;
  if (emailNorm) {
    if (!isSendGridConfigured()) {
      confirmationEmailFailed =
        "SendGrid is not configured — confirmation email was not sent.";
    } else {
      const emailBodies = buildBookingConfirmationEmailBodies({
        customerName: name,
        salonName,
        serviceName: typeof svc.name === "string" ? svc.name : "Appointment",
        startTimeIso: start.toISOString(),
        bookingReference: bookingRef,
      });
      const er = await sendTransactionalEmail({
        to: emailNorm,
        subject: emailBodies.subject,
        text: emailBodies.text,
        html: emailBodies.html,
      });
      if (er.ok) {
        await supabase
          .from("appointments")
          .update({ confirmation_email_sent_at: new Date().toISOString() })
          .eq("id", insertedId)
          .eq("organization_id", organizationId);
      } else {
        confirmationEmailFailed = er.message;
      }
    }
  }

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
    return {
      ok: true,
      appointmentId: insertedId,
      ...(confirmationEmailFailed
        ? { confirmationEmailFailed }
        : {}),
    };
  }

  const smsFailedReason =
    sms.message === "Twilio not configured"
      ? "SMS is not configured (add Twilio credentials to this environment)."
      : sms.message;

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return {
    ok: true,
    appointmentId: insertedId,
    confirmationSmsFailed: smsFailedReason,
    ...(confirmationEmailFailed ? { confirmationEmailFailed } : {}),
  };
}
