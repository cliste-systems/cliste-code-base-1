import type { SupabaseClient } from "@supabase/supabase-js";

import {
  addDaysToYmd,
  getCalendarDayUtcRange,
  todayYmdInTimeZone,
} from "@/lib/booking-available-slots";

/** How far ahead Cara loads confirmed visits for diary + cancel matching (salon calendar days). */
export const CARA_APPOINTMENT_LOOKAHEAD_DAYS = 42;

export type CaraNearTermAppointment = {
  id: string;
  customer_name: string;
  start_time: string;
  end_time: string;
};

/**
 * Confirmed appointments from the start of “today” in the salon TZ through
 * the end of the last included wall day (lookahead window).
 * Used for Cara scheduling answers and cancel-intent resolution (server-side only).
 */
export async function loadCaraNearTermConfirmedAppointments(
  supabase: SupabaseClient,
  organizationId: string,
  timeZone: string,
): Promise<CaraNearTermAppointment[]> {
  const todayYmd = todayYmdInTimeZone(timeZone);
  const startUtc = getCalendarDayUtcRange(todayYmd, timeZone).startUtc;
  const lastIncludedYmd = addDaysToYmd(
    todayYmd,
    CARA_APPOINTMENT_LOOKAHEAD_DAYS - 1,
    timeZone,
  );
  const endExclusiveUtc = getCalendarDayUtcRange(
    addDaysToYmd(lastIncludedYmd, 1, timeZone),
    timeZone,
  ).startUtc;

  const { data, error } = await supabase
    .from("appointments")
    .select("id, customer_name, start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .gte("start_time", startUtc.toISOString())
    .lt("start_time", endExclusiveUtc.toISOString())
    .order("start_time", { ascending: true })
    .limit(120);

  if (error || !data) return [];

  return data.map((row) => ({
    id: String(row.id),
    customer_name: String(row.customer_name ?? "Guest"),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
  }));
}
