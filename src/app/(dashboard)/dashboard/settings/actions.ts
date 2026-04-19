"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";

import type { WeekSchedule } from "./business-hours";
import { type BookingRules } from "./booking-rules";

const ALLOWED_INTERVALS = new Set([5, 10, 15, 20, 30, 60]);

export async function saveBookingRules(
  payload: BookingRules,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardSession();

  if (!ALLOWED_INTERVALS.has(payload.slotIntervalMin)) {
    return {
      ok: false,
      message: "Slot interval must be 5, 10, 15, 20, 30 or 60 minutes.",
    };
  }
  if (payload.minNoticeMin < 0 || payload.minNoticeMin > 7 * 24 * 60) {
    return { ok: false, message: "Minimum notice is out of range." };
  }
  if (payload.maxAdvanceDays < 1 || payload.maxAdvanceDays > 365) {
    return { ok: false, message: "Booking horizon must be 1\u2013365 days." };
  }
  if (
    payload.cancellationWindowHours < 0 ||
    payload.cancellationWindowHours > 14 * 24
  ) {
    return { ok: false, message: "Cancellation window is out of range." };
  }
  if (payload.cancellationPolicy.length > 1000) {
    return { ok: false, message: "Cancellation policy is too long (max 1000)." };
  }

  const json = {
    slot_interval_min: payload.slotIntervalMin,
    min_notice_min: payload.minNoticeMin,
    max_advance_days: payload.maxAdvanceDays,
    cancellation_policy: payload.cancellationPolicy.trim(),
    cancellation_window_hours: payload.cancellationWindowHours,
    allow_double_booking: payload.allowDoubleBooking,
    auto_confirm_online: payload.autoConfirmOnline,
  };

  const { error } = await supabase
    .from("organizations")
    .update({
      booking_rules: json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export type OrganizationSettingsPayload = {
  isActive: boolean;
  freshaUrl: string;
  businessHours: WeekSchedule;
};

export async function saveOrganizationSettings(
  payload: OrganizationSettingsPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: tierRow, error: tierError } = await supabase
    .from("organizations")
    .select("tier")
    .eq("id", organizationId)
    .single();

  if (tierError || !tierRow) {
    return {
      ok: false,
      message: tierError?.message ?? "Could not load organization.",
    };
  }

  const updates: Record<string, unknown> = {
    is_active: payload.isActive,
    business_hours: payload.businessHours,
    updated_at: new Date().toISOString(),
  };

  if (tierRow.tier === "connect") {
    updates.fresha_url = payload.freshaUrl.trim() || null;
  }

  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
