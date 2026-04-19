import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCalendarDayUtcRange,
  staffDayWindowsForDate,
  type BusyInterval,
  type StaffDayWindow,
} from "@/lib/booking-available-slots";

/**
 * Loads `staff_working_hours` + `staff_time_off` for one stylist and
 * resolves them to a list of bookable windows (in salon-local minutes
 * since midnight) for the given calendar day.
 *
 * The caller passes the JS-style weekday (0 = Sunday … 6 = Saturday).
 * Returns `null` when the stylist has no `staff_working_hours` set at
 * all — semantically: "use organization business_hours, no extra
 * filtering". Returns `[]` when the stylist is set up but not working
 * that day or fully blocked by time off.
 *
 * Errors bubble up (caller decides whether to fail open or hard).
 */
export async function loadStaffDayWindowsFor(
  supabase: SupabaseClient,
  organizationId: string,
  staffId: string,
  dateYmd: string,
  timeZone: string,
  weekday: number,
): Promise<{ windows: StaffDayWindow[] | null; error: string | null }> {
  const { startUtc, endExclusiveUtc } = getCalendarDayUtcRange(
    dateYmd,
    timeZone,
  );

  const [hoursRes, offRes] = await Promise.all([
    supabase
      .from("staff_working_hours")
      .select("weekday, opens_at, closes_at")
      .eq("organization_id", organizationId)
      .eq("staff_id", staffId),
    supabase
      .from("staff_time_off")
      .select("starts_at, ends_at")
      .eq("organization_id", organizationId)
      .eq("staff_id", staffId)
      .lt("starts_at", endExclusiveUtc.toISOString())
      .gt("ends_at", startUtc.toISOString()),
  ]);

  if (hoursRes.error) {
    return { windows: null, error: hoursRes.error.message };
  }
  if (offRes.error) {
    return { windows: null, error: offRes.error.message };
  }

  const allHours = (hoursRes.data ?? []).map((h) => ({
    weekday: Number(h.weekday),
    opensAt: String(h.opens_at),
    closesAt: String(h.closes_at),
  }));
  if (allHours.length === 0) {
    // Empty hours table for this stylist — fall back to org hours.
    return { windows: null, error: null };
  }

  const timeOff = (offRes.data ?? []).map((o) => ({
    startsAt: String(o.starts_at),
    endsAt: String(o.ends_at),
  }));

  const windows = staffDayWindowsForDate({
    dateYmd,
    timeZone,
    weekday,
    workingHours: allHours,
    timeOff,
  });
  return { windows, error: null };
}

/**
 * Loads a per-stylist busy interval list for one calendar day. Equivalent
 * to `fetchBusyIntervalsForCalendarDayForOrg` but scoped to a single
 * `staff_id` so the public flow can ask "is THIS stylist free?".
 */
export async function fetchStaffBusyIntervalsForDay(
  supabase: SupabaseClient,
  organizationId: string,
  staffId: string,
  dateYmd: string,
  timeZone: string,
): Promise<{ busy: BusyInterval[]; error: string | null }> {
  const { startUtc, endExclusiveUtc } = getCalendarDayUtcRange(
    dateYmd,
    timeZone,
  );
  const { data, error } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .eq("staff_id", staffId)
    .lt("start_time", endExclusiveUtc.toISOString())
    .gt("end_time", startUtc.toISOString());

  if (error) {
    return { busy: [], error: error.message };
  }
  return {
    busy: (data ?? []).map((r) => ({
      start: new Date(String(r.start_time)),
      end: new Date(String(r.end_time)),
    })),
    error: null,
  };
}

/**
 * Returns the list of staff_ids eligible to perform a given service
 * (rows in `staff_services`). Empty result means "no restriction" — the
 * salon hasn't configured eligibility yet, so any active staff member
 * can perform the service.
 */
export async function fetchEligibleStaffIdsForService(
  supabase: SupabaseClient,
  organizationId: string,
  serviceId: string,
): Promise<{ staffIds: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id")
    .eq("organization_id", organizationId)
    .eq("service_id", serviceId);
  if (error) return { staffIds: [], error: error.message };
  return {
    staffIds: (data ?? []).map((r) => String(r.staff_id)),
    error: null,
  };
}
