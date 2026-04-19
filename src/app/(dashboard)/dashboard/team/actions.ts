"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type StaffWeeklyHoursInput = {
  weekday: number;
  opensAt: string;
  closesAt: string;
};

export type SaveStaffHoursResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Replace the whole weekly schedule for a single stylist with the
 * supplied list of windows. Multiple rows on the same weekday are
 * allowed (lunch breaks).
 */
export async function saveStaffWeeklyHours(payload: {
  staffId: string;
  windows: StaffWeeklyHoursInput[];
}): Promise<SaveStaffHoursResult> {
  const staffId = payload.staffId.trim();
  if (!UUID_RE.test(staffId)) {
    return { ok: false, message: "Invalid staff id." };
  }

  const cleaned: StaffWeeklyHoursInput[] = [];
  for (const w of payload.windows) {
    const wd = Number(w.weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) {
      return { ok: false, message: "Invalid weekday." };
    }
    if (!HHMM_RE.test(w.opensAt) || !HHMM_RE.test(w.closesAt)) {
      return { ok: false, message: "Invalid time (HH:MM)." };
    }
    if (w.opensAt >= w.closesAt) {
      return {
        ok: false,
        message: "Each window must close after it opens.",
      };
    }
    cleaned.push({
      weekday: wd,
      opensAt: w.opensAt,
      closesAt: w.closesAt,
    });
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: target, error: targetErr } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", staffId)
    .maybeSingle();
  if (targetErr) return { ok: false, message: targetErr.message };
  if (!target || target.organization_id !== organizationId) {
    return { ok: false, message: "Staff member not in this organization." };
  }

  const { error: delErr } = await supabase
    .from("staff_working_hours")
    .delete()
    .eq("organization_id", organizationId)
    .eq("staff_id", staffId);
  if (delErr) return { ok: false, message: delErr.message };

  if (cleaned.length > 0) {
    const { error: insErr } = await supabase
      .from("staff_working_hours")
      .insert(
        cleaned.map((w) => ({
          organization_id: organizationId,
          staff_id: staffId,
          weekday: w.weekday,
          opens_at: w.opensAt,
          closes_at: w.closesAt,
        })),
      );
    if (insErr) return { ok: false, message: insErr.message };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export type AddStaffTimeOffResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export async function addStaffTimeOff(payload: {
  staffId: string;
  startsAtIso: string;
  endsAtIso: string;
  reason?: string | null;
}): Promise<AddStaffTimeOffResult> {
  const staffId = payload.staffId.trim();
  if (!UUID_RE.test(staffId)) {
    return { ok: false, message: "Invalid staff id." };
  }
  const start = new Date(payload.startsAtIso);
  const end = new Date(payload.endsAtIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: "Invalid date." };
  }
  if (end <= start) {
    return { ok: false, message: "End must be after start." };
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: target } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", staffId)
    .maybeSingle();
  if (!target || target.organization_id !== organizationId) {
    return { ok: false, message: "Staff member not in this organization." };
  }

  const reason = (payload.reason ?? "").trim().slice(0, 200) || null;
  const { data, error } = await supabase
    .from("staff_time_off")
    .insert({
      organization_id: organizationId,
      staff_id: staffId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      reason,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/calendar");
  return { ok: true, id: String(data.id) };
}

export type DeleteStaffTimeOffResult =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteStaffTimeOff(
  timeOffId: string,
): Promise<DeleteStaffTimeOffResult> {
  const id = timeOffId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid id." };
  }
  const { supabase, organizationId } = await requireDashboardSession();
  const { error } = await supabase
    .from("staff_time_off")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export type SaveStaffServicesResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Replace the set of services this staff member can perform with the
 * supplied list. Empty list means "this stylist performs no services" —
 * note this is DIFFERENT from "no rows in staff_services for this org",
 * which is the legacy default ("everyone does everything").
 *
 * Use the explicit `clearAll: true` flag if you want to revert the
 * stylist back to the default-permissive state.
 */
export async function saveStaffServices(payload: {
  staffId: string;
  serviceIds: string[];
  clearAll?: boolean;
}): Promise<SaveStaffServicesResult> {
  const staffId = payload.staffId.trim();
  if (!UUID_RE.test(staffId)) {
    return { ok: false, message: "Invalid staff id." };
  }
  for (const id of payload.serviceIds) {
    if (!UUID_RE.test(id)) {
      return { ok: false, message: "Invalid service id." };
    }
  }

  const { supabase, organizationId } = await requireDashboardSession();
  const { data: target } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", staffId)
    .maybeSingle();
  if (!target || target.organization_id !== organizationId) {
    return { ok: false, message: "Staff member not in this organization." };
  }

  const { error: delErr } = await supabase
    .from("staff_services")
    .delete()
    .eq("organization_id", organizationId)
    .eq("staff_id", staffId);
  if (delErr) return { ok: false, message: delErr.message };

  if (!payload.clearAll && payload.serviceIds.length > 0) {
    const { error: insErr } = await supabase.from("staff_services").insert(
      payload.serviceIds.map((sid) => ({
        organization_id: organizationId,
        staff_id: staffId,
        service_id: sid,
      })),
    );
    if (insErr) return { ok: false, message: insErr.message };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}
