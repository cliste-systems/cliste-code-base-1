/** Serialized row for the dashboard day calendar (from Supabase + join). */
export type CalendarAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  service_name: string;
  /** Assigned professional (`profiles.id`), or null when unassigned. */
  staff_id: string | null;
  booking_reference?: string;
  status: "confirmed" | "cancelled" | "completed";
  source: "booking_link" | "ai_call" | "dashboard";
};
