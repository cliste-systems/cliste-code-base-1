import type { SupabaseClient } from "@supabase/supabase-js";

/** Shown when a new booking would overlap an existing confirmed slot */
export const APPOINTMENT_OVERLAP_MESSAGE =
  "That time slot is already booked. Choose a different time.";

/**
 * True if any **confirmed** appointment for this org overlaps [start, end)
 * (half-open intervals; touching edges do not overlap).
 * When `staffId` is set, only that professional's appointments are considered
 * (public booking with a chosen stylist).
 */
export async function hasConfirmedAppointmentOverlap(
  client: SupabaseClient,
  organizationId: string,
  start: Date,
  end: Date,
  staffId?: string | null,
): Promise<{ overlap: boolean; error: string | null }> {
  if (end.getTime() <= start.getTime()) {
    return { overlap: false, error: "Invalid time range." };
  }

  let q = client
    .from("appointments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString());
  if (staffId) {
    q = q.eq("staff_id", staffId);
  }
  const { data, error } = await q.limit(1);

  if (error) {
    return { overlap: false, error: error.message };
  }

  return { overlap: (data?.length ?? 0) > 0, error: null };
}

export function isDatabaseOverlapConstraintError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("appointments_confirmed_no_overlap") ||
    m.includes("violates exclusion constraint") ||
    m.includes("exclusion_violation")
  );
}
