"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { parseBusinessHoursFromDb } from "@/app/(dashboard)/dashboard/settings/business-hours";
import {
  buildBookingConfirmationSmsBody,
  sendPublicBookingOtpSms,
  sendTwilioBookingSms,
} from "@/lib/booking-confirmation-sms";
import {
  buildBookingConfirmationEmailBodies,
  normalizeOptionalCustomerEmail,
} from "@/lib/booking-transactional-email";
import {
  addDaysToYmd,
  computeAvailableBookingSlots,
  getCalendarDayUtcRange,
  getSalonTimeZone,
  type BusyInterval,
  type DashboardBookingSlot,
} from "@/lib/booking-available-slots";
import {
  generateBookingReference,
  isPlausibleCustomerPhoneE164,
  normalizeCustomerPhoneE164,
} from "@/lib/booking-reference";
import {
  assertBookingStartTimeAllowed,
  hashIpForRateLimit,
  isOtpBypassEnabled,
  isSuspiciousPhonePattern,
  verifyTurnstileToken,
} from "@/lib/public-booking-security";
import {
  assertBookingSubmitRateAllowed,
  assertOtpSendRateAllowed,
  assertPhoneBookingsPerDayAllowed,
  hasDuplicateBookingStart,
  recordPublicBookingRateEvent,
} from "@/lib/public-booking-rate-limit";
import {
  generateSixDigitOtp,
  hashBookingOtpCode,
  otpCodesEqual,
  PUBLIC_BOOKING_OTP_MAX_ATTEMPTS,
  PUBLIC_BOOKING_OTP_TTL_MS,
} from "@/lib/public-booking-otp";
import {
  APPOINTMENT_OVERLAP_MESSAGE,
  hasConfirmedAppointmentOverlap,
  isDatabaseOverlapConstraintError,
} from "@/lib/appointments-overlap";
import {
  checkTwilioVerifyBookingCode,
  isTwilioVerifyConfigured,
  startTwilioVerifyBookingSms,
} from "@/lib/twilio-verify-public-booking";
import { servicesTableHasExtendedColumns } from "@/lib/services-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

async function fetchBusyIntervalsPublic(
  admin: SupabaseClient,
  organizationId: string,
  dateYmd: string,
  tz: string,
): Promise<{ busy: BusyInterval[]; error: string | null }> {
  const { startUtc, endExclusiveUtc } = getCalendarDayUtcRange(dateYmd, tz);
  const { data, error } = await admin
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

function busyIntervalsForCalendarDay(
  appointments: { start: Date; end: Date }[],
  dateYmd: string,
  tz: string,
): BusyInterval[] {
  const { startUtc, endExclusiveUtc } = getCalendarDayUtcRange(dateYmd, tz);
  const out: BusyInterval[] = [];
  for (const a of appointments) {
    const s = new Date(Math.max(a.start.getTime(), startUtc.getTime()));
    const e = new Date(Math.min(a.end.getTime(), endExclusiveUtc.getTime()));
    if (s < e) out.push({ start: s, end: e });
  }
  return out;
}

async function fetchConfirmedAppointmentsOverlappingUtcRange(
  admin: SupabaseClient,
  organizationId: string,
  rangeStartUtc: Date,
  rangeEndExclusiveUtc: Date,
  /** When set, only this stylist's bookings reduce availability */
  staffId?: string | null,
): Promise<{ appointments: { start: Date; end: Date }[]; error: string | null }> {
  let q = admin
    .from("appointments")
    .select("start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .lt("start_time", rangeEndExclusiveUtc.toISOString())
    .gt("end_time", rangeStartUtc.toISOString());
  if (staffId) {
    q = q.eq("staff_id", staffId);
  }
  const { data, error } = await q;

  if (error) {
    return { appointments: [], error: error.message };
  }
  const appointments = (data ?? []).map((r) => ({
    start: new Date(String(r.start_time)),
    end: new Date(String(r.end_time)),
  }));
  return { appointments, error: null };
}

export type GetPublicBookingSlotsResult =
  | { ok: true; slots: DashboardBookingSlot[]; timeZone: string }
  | { ok: false; message: string };

/** Public booking link: slots for a service on a calendar day (native tier only). */
export async function getPublicBookingSlots(payload: {
  organizationId: string;
  serviceId: string;
  dateYmd: string;
}): Promise<GetPublicBookingSlotsResult> {
  const organizationId = payload.organizationId.trim();
  const serviceId = payload.serviceId.trim();
  const dateYmd = payload.dateYmd.trim();

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(serviceId)) {
    return { ok: false, message: "Invalid request." };
  }
  if (!DATE_YMD_RE.test(dateYmd)) {
    return { ok: false, message: "Invalid date." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Booking is temporarily unavailable.",
    };
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("business_hours, tier, is_active")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !org?.is_active || org.tier !== "native") {
    return { ok: false, message: "Online booking is not available." };
  }

  const extended = await servicesTableHasExtendedColumns(admin);
  let svcQuery = admin
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .eq("organization_id", organizationId);
  if (extended) {
    svcQuery = svcQuery.eq("is_published", true);
  }
  const { data: svc, error: svcError } = await svcQuery.maybeSingle();

  if (svcError || !svc) {
    return { ok: false, message: "Service not found." };
  }

  const tz = getSalonTimeZone();
  const schedule = parseBusinessHoursFromDb(org.business_hours);
  const { busy, error: busyErr } = await fetchBusyIntervalsPublic(
    admin,
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

export type GetPublicBookingSlotsRangeResult =
  | {
      ok: true;
      timeZone: string;
      /** ISO date keys `yyyy-MM-dd` → slots that day */
      slotsByDate: Record<string, DashboardBookingSlot[]>;
      /** First day in the requested window with ≥1 slot; `null` if none */
      firstAvailableYmd: string | null;
    }
  | { ok: false; message: string };

/**
 * Prefetch slots for several consecutive calendar days in one round trip (single
 * appointments query + in-memory slot math). Used by the public booking page.
 */
export async function getPublicBookingSlotsRange(payload: {
  organizationId: string;
  serviceId: string;
  /** First calendar day (yyyy-MM-dd) in salon TZ, usually today */
  startYmd: string;
  /** Number of consecutive days (default 14) */
  days?: number;
  /** Optional stylist; when set, busy times are only that person's bookings */
  staffId?: string | null;
}): Promise<GetPublicBookingSlotsRangeResult> {
  const organizationId = payload.organizationId.trim();
  const serviceId = payload.serviceId.trim();
  const startYmd = payload.startYmd.trim();
  const days = Math.min(42, Math.max(1, payload.days ?? 14));
  const staffId =
    typeof payload.staffId === "string" && UUID_RE.test(payload.staffId.trim())
      ? payload.staffId.trim()
      : null;

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(serviceId)) {
    return { ok: false, message: "Invalid request." };
  }
  if (!DATE_YMD_RE.test(startYmd)) {
    return { ok: false, message: "Invalid date." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Booking is temporarily unavailable.",
    };
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("business_hours, tier, is_active")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !org?.is_active || org.tier !== "native") {
    return { ok: false, message: "Online booking is not available." };
  }

  const extended = await servicesTableHasExtendedColumns(admin);
  let svcQuery = admin
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .eq("organization_id", organizationId);
  if (extended) {
    svcQuery = svcQuery.eq("is_published", true);
  }
  const { data: svc, error: svcError } = await svcQuery.maybeSingle();

  if (svcError || !svc) {
    return { ok: false, message: "Service not found." };
  }

  const tz = getSalonTimeZone();
  const schedule = parseBusinessHoursFromDb(org.business_hours);
  const lastYmd = addDaysToYmd(startYmd, days - 1, tz);
  const rangeStartUtc = getCalendarDayUtcRange(startYmd, tz).startUtc;
  const rangeEndExclusiveUtc = getCalendarDayUtcRange(lastYmd, tz).endExclusiveUtc;

  const { appointments, error: apptErr } =
    await fetchConfirmedAppointmentsOverlappingUtcRange(
      admin,
      organizationId,
      rangeStartUtc,
      rangeEndExclusiveUtc,
      staffId,
    );
  if (apptErr) {
    return { ok: false, message: apptErr };
  }

  const now = new Date();
  const slotsByDate: Record<string, DashboardBookingSlot[]> = {};
  let firstAvailableYmd: string | null = null;

  for (let i = 0; i < days; i++) {
    const dateYmd = addDaysToYmd(startYmd, i, tz);
    const busy = busyIntervalsForCalendarDay(appointments, dateYmd, tz);
    const slots = computeAvailableBookingSlots({
      dateYmd,
      durationMinutes: svc.duration_minutes,
      weekSchedule: schedule,
      busy,
      now,
      timeZone: tz,
    });
    slotsByDate[dateYmd] = slots;
    if (firstAvailableYmd === null && slots.length > 0) {
      firstAvailableYmd = dateYmd;
    }
  }

  return { ok: true, timeZone: tz, slotsByDate, firstAvailableYmd };
}

export type RequestPublicBookingOtpResult =
  | { success: true }
  | { success: false; message: string };

async function getClientIpHash(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const ip =
    xff?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
  return hashIpForRateLimit(ip);
}

async function verifyAndConsumeOtpChallenge(
  admin: SupabaseClient,
  organizationId: string,
  phoneE164: string,
  codeRaw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isOtpBypassEnabled()) return { ok: true };
  const trimmed = codeRaw.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, message: "Enter the 6-digit code from your text." };
  }
  const expectedHash = hashBookingOtpCode(organizationId, phoneE164, trimmed);

  const { data: row, error } = await admin
    .from("public_booking_otp_challenges")
    .select("id, code_hash, attempt_count")
    .eq("organization_id", organizationId)
    .eq("phone_e164", phoneE164)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      message: "Request a verification code first, or ask for a new one.",
    };
  }
  if (row.attempt_count >= PUBLIC_BOOKING_OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      message: "Too many wrong attempts. Request a new code.",
    };
  }
  const match = await otpCodesEqual(expectedHash, row.code_hash);
  if (!match) {
    await admin
      .from("public_booking_otp_challenges")
      .update({ attempt_count: row.attempt_count + 1 })
      .eq("id", row.id);
    return { ok: false, message: "That code is not correct." };
  }
  await admin
    .from("public_booking_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ok: true };
}

async function verifyPublicBookingOtp(
  admin: SupabaseClient,
  organizationId: string,
  phoneE164: string,
  codeRaw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isOtpBypassEnabled()) return { ok: true };
  if (isTwilioVerifyConfigured()) {
    return checkTwilioVerifyBookingCode(phoneE164, codeRaw);
  }
  return verifyAndConsumeOtpChallenge(admin, organizationId, phoneE164, codeRaw);
}

/** Send SMS OTP after Turnstile + rate limits (public booking). */
export async function requestPublicBookingOtp(payload: {
  organizationId: string;
  turnstileToken: string;
  customerPhone: string;
}): Promise<RequestPublicBookingOtpResult> {
  const organizationId = payload.organizationId.trim();
  if (!UUID_RE.test(organizationId)) {
    return { success: false, message: "Invalid request." };
  }

  const ts = await verifyTurnstileToken(payload.turnstileToken);
  if (!ts.ok) return { success: false, message: ts.message };

  const customerPhone = String(payload.customerPhone ?? "").trim();
  if (!customerPhone) {
    return { success: false, message: "Please enter your phone number." };
  }

  const phoneE164 = normalizeCustomerPhoneE164(customerPhone);
  if (!isPlausibleCustomerPhoneE164(phoneE164)) {
    return {
      success: false,
      message: "Please enter a full mobile number including area code.",
    };
  }
  if (isSuspiciousPhonePattern(phoneE164)) {
    return { success: false, message: "Please check your phone number." };
  }

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof Error
          ? e.message
          : "Booking is temporarily unavailable.",
    };
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, tier, is_active, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !org?.is_active || org.tier !== "native") {
    return {
      success: false,
      message: "Online booking is not available for this salon.",
    };
  }

  const ipHash = await getClientIpHash();
  const rate = await assertOtpSendRateAllowed(
    admin,
    organizationId,
    phoneE164,
    ipHash,
  );
  if (!rate.ok) return { success: false, message: rate.message };

  if (isTwilioVerifyConfigured()) {
    const v = await startTwilioVerifyBookingSms(phoneE164);
    if (!v.ok) {
      return { success: false, message: v.message };
    }
    await recordPublicBookingRateEvent(admin, {
      kind: "otp_request",
      organizationId,
      ipHash,
      phoneE164,
    });
    return { success: true };
  }

  const code = generateSixDigitOtp();
  const codeHash = hashBookingOtpCode(organizationId, phoneE164, code);
  const expiresAt = new Date(Date.now() + PUBLIC_BOOKING_OTP_TTL_MS).toISOString();

  const { error: insErr } = await admin.from("public_booking_otp_challenges").insert({
    organization_id: organizationId,
    phone_e164: phoneE164,
    code_hash: codeHash,
    expires_at: expiresAt,
    attempt_count: 0,
  });

  if (insErr) {
    console.error(
      "public_booking_otp_challenges insert failed",
      insErr.code,
      insErr.message,
      insErr.details,
    );
    const m = (insErr.message ?? "").toLowerCase();
    const hints: string[] = [];
    if (m.includes("relation") || m.includes("does not exist")) {
      hints.push("Run Supabase migration 019_public_booking_security.sql.");
    }
    if (m.includes("permission denied") || insErr.code === "42501") {
      hints.push(
        "Confirm SUPABASE_SERVICE_ROLE_KEY is set on the server for this app.",
      );
    }
    const hintSuffix = hints.length ? ` ${hints.join(" ")}` : "";
    const codeBit = insErr.code ? ` (${insErr.code})` : "";
    return {
      success: false,
      message:
        process.env.NODE_ENV === "development"
          ? `Could not send a code: ${insErr.message}`
          : `Could not send a verification code${codeBit}.${hintSuffix} Check Vercel logs for details.`,
    };
  }

  const salonName = typeof org.name === "string" ? org.name : "Salon";
  const sms = await sendPublicBookingOtpSms(phoneE164, code, salonName);
  if (!sms.ok) {
    return {
      success: false,
      message:
        sms.message === "Twilio not configured"
          ? "SMS is not configured for this salon yet."
          : sms.message,
    };
  }

  await recordPublicBookingRateEvent(admin, {
    kind: "otp_request",
    organizationId,
    ipHash,
    phoneE164,
  });

  return { success: true };
}

export type SubmitPublicBookingResult =
  | { success: true }
  | { success: false; message: string };

/**
 * Inserts an appointment for an anonymous visitor. Uses the service role only
 * after verifying the org is active + native and the service belongs to it.
 */
export async function submitPublicBooking(
  formData: FormData,
  organizationId: string,
  serviceId: string,
  /** Refreshes the public storefront cache after a successful booking. */
  salonSlug?: string
): Promise<SubmitPublicBookingResult> {
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(serviceId)) {
    return { success: false, message: "Something went wrong. Please refresh and try again." };
  }

  if (String(formData.get("booking_website") ?? "").trim()) {
    return { success: false, message: "Could not complete booking." };
  }

  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim();
  const customerEmailRaw = String(formData.get("customer_email") ?? "").trim();
  const customerEmailNorm = normalizeOptionalCustomerEmail(customerEmailRaw);
  const startIso = String(formData.get("start_time_iso") ?? "").trim();
  const otpCode = String(formData.get("booking_otp_code") ?? "").trim();

  if (!customerName) {
    return { success: false, message: "Please enter your name." };
  }
  if (!customerPhone) {
    return { success: false, message: "Please enter your phone number." };
  }
  if (customerEmailRaw && !customerEmailNorm) {
    return { success: false, message: "Please check the email address." };
  }
  if (!startIso) {
    return { success: false, message: "Please choose a date and time." };
  }

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return { success: false, message: "That date and time is not valid." };
  }

  if (start.getTime() < Date.now() - 60_000) {
    return { success: false, message: "Please choose a time in the future." };
  }

  const windowOk = assertBookingStartTimeAllowed(start);
  if (!windowOk.ok) {
    return { success: false, message: windowOk.message };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof Error
          ? e.message
          : "Booking is temporarily unavailable.",
    };
  }

  const phoneE164 = normalizeCustomerPhoneE164(customerPhone);
  if (!isPlausibleCustomerPhoneE164(phoneE164)) {
    return {
      success: false,
      message: "Please enter a full mobile number including area code.",
    };
  }
  if (isSuspiciousPhonePattern(phoneE164)) {
    return { success: false, message: "Please check your phone number." };
  }

  const ipHash = await getClientIpHash();
  const submitRate = await assertBookingSubmitRateAllowed(
    admin,
    organizationId,
    ipHash,
  );
  if (!submitRate.ok) {
    return { success: false, message: submitRate.message };
  }

  const dayRate = await assertPhoneBookingsPerDayAllowed(
    admin,
    organizationId,
    phoneE164,
  );
  if (!dayRate.ok) {
    return { success: false, message: dayRate.message };
  }

  const dup = await hasDuplicateBookingStart(
    admin,
    organizationId,
    phoneE164,
    start.toISOString(),
  );
  if (dup) {
    return {
      success: false,
      message: "You already have a booking at this time.",
    };
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, tier, is_active, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !org?.is_active || org.tier !== "native") {
    return {
      success: false,
      message: "Online booking is not available for this salon.",
    };
  }

  const extended = await servicesTableHasExtendedColumns(admin);
  let svcQuery = admin
    .from("services")
    .select("id, organization_id, duration_minutes, name")
    .eq("id", serviceId)
    .eq("organization_id", organizationId);
  if (extended) {
    svcQuery = svcQuery.eq("is_published", true);
  }
  const { data: svc, error: svcErr } = await svcQuery.maybeSingle();

  if (svcErr || !svc) {
    return { success: false, message: "That service is no longer available." };
  }

  const end = new Date(start.getTime() + svc.duration_minutes * 60_000);

  const staffIdRaw = String(formData.get("staff_id") ?? "").trim();
  let resolvedStaffId: string | null = null;
  if (staffIdRaw && UUID_RE.test(staffIdRaw)) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("id", staffIdRaw)
      .eq("organization_id", organizationId)
      .in("role", ["staff", "admin"])
      .maybeSingle();
    if (prof?.id) resolvedStaffId = prof.id as string;
  }

  const { overlap, error: overlapErr } = await hasConfirmedAppointmentOverlap(
    admin,
    organizationId,
    start,
    end,
    resolvedStaffId,
  );
  if (overlapErr) {
    return { success: false, message: overlapErr };
  }
  if (overlap) {
    return { success: false, message: APPOINTMENT_OVERLAP_MESSAGE };
  }

  const otpOk = await verifyPublicBookingOtp(
    admin,
    organizationId,
    phoneE164,
    otpCode,
  );
  if (!otpOk.ok) {
    return { success: false, message: otpOk.message };
  }

  let insertedId: string | null = null;
  let bookingRef: string | null = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const ref = generateBookingReference();
    const { data: row, error: insErr } = await admin
      .from("appointments")
      .insert({
        organization_id: organizationId,
        customer_name: customerName,
        customer_phone: phoneE164,
        customer_email: customerEmailNorm,
        service_id: serviceId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        source: "booking_link",
        booking_reference: ref,
        ...(resolvedStaffId ? { staff_id: resolvedStaffId } : {}),
      })
      .select("id")
      .single();

    if (!insErr && row?.id) {
      insertedId = row.id as string;
      bookingRef = ref;
      break;
    }
    const msg = insErr?.message ?? "";
    if (msg.includes("booking_reference") || msg.includes("23505")) {
      continue;
    }
    return {
      success: false,
      message: isDatabaseOverlapConstraintError(msg)
        ? APPOINTMENT_OVERLAP_MESSAGE
        : msg || "Could not complete booking.",
    };
  }

  if (!insertedId || !bookingRef) {
    return {
      success: false,
      message: "Could not complete booking. Please try again.",
    };
  }

  const salonName = org?.name?.trim() || "Salon";
  const serviceName = typeof svc.name === "string" ? svc.name : "Appointment";
  const body = buildBookingConfirmationSmsBody({
    customerName: customerName,
    salonName,
    serviceName,
    startTimeIso: start.toISOString(),
    bookingReference: bookingRef,
  });

  const sms = await sendTwilioBookingSms(phoneE164, body);
  if (sms.ok) {
    await admin
      .from("appointments")
      .update({ confirmation_sms_sent_at: new Date().toISOString() })
      .eq("id", insertedId)
      .eq("organization_id", organizationId);
  }

  if (customerEmailNorm && isSendGridConfigured()) {
    const emailBodies = buildBookingConfirmationEmailBodies({
      customerName,
      salonName,
      serviceName,
      startTimeIso: start.toISOString(),
      bookingReference: bookingRef,
    });
    const er = await sendTransactionalEmail({
      to: customerEmailNorm,
      subject: emailBodies.subject,
      text: emailBodies.text,
      html: emailBodies.html,
    });
    if (er.ok) {
      await admin
        .from("appointments")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("id", insertedId)
        .eq("organization_id", organizationId);
    } else {
      console.warn("Public booking confirmation email failed", er.message);
    }
  }

  await recordPublicBookingRateEvent(admin, {
    kind: "booking_submit",
    organizationId,
    ipHash,
    phoneE164,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  const slug = salonSlug?.trim().toLowerCase();
  if (slug && /^[a-z0-9-]+$/.test(slug)) {
    revalidatePath(`/${slug}`);
  }
  return { success: true };
}
