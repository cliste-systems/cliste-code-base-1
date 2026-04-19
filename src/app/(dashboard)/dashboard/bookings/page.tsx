import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";

import { getReminderTimezone } from "@/lib/appointment-reminder-sms";
import { requireDashboardSession } from "@/lib/dashboard-session";

import {
  BookingsView,
  type AppointmentListRow,
  type ServiceOption,
} from "./bookings-view";

export default async function BookingsPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("tier")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgRow?.tier !== "native") {
    redirect("/dashboard");
  }

  // Pull a wide window so the Upcoming / Today / Past / Cancelled tabs
  // all have data to filter from. Cap at ~6 months back to keep the
  // payload sane (history pages will paginate later).
  /* eslint-disable react-hooks/purity -- server component; deterministic per request */
  const sixMonthsAgoIso = new Date(
    Date.now() - 1000 * 60 * 60 * 24 * 180,
  ).toISOString();
  /* eslint-enable react-hooks/purity */

  const [
    { data: appointmentRows, error: apptError },
    { data: serviceRows },
    { data: staffRows },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        `
          id,
          customer_name,
          customer_phone,
          start_time,
          end_time,
          status,
          source,
          booking_reference,
          call_log_id,
          ai_booking_notes,
          confirmation_sms_sent_at,
          confirmation_email_sent_at,
          reminder_sent_at,
          reminder_email_sent_at,
          customer_email,
          payment_status,
          amount_cents,
          service_total_cents,
          deposit_cents,
          balance_due_cents,
          currency,
          paid_at,
          payment_link_sent_at,
          stripe_checkout_session_id,
          staff_id,
          service_id,
          cancel_reason,
          cancelled_at,
          series_id,
          recurrence_rule,
          services (
            name,
            price
          )
        `
      )
      .eq("organization_id", organizationId)
      .gte("end_time", sixMonthsAgoIso)
      .order("start_time", { ascending: false })
      .limit(500),
    supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, name, role")
      .eq("organization_id", organizationId)
      .in("role", ["staff", "admin"])
      .order("name", { ascending: true }),
  ]);

  const appointments: AppointmentListRow[] = (appointmentRows ?? []).map(
    (row) => {
      const src = row.source;
      const source: AppointmentListRow["source"] =
        src === "ai_call" || src === "booking_link" || src === "dashboard"
          ? src
          : "dashboard";

      return {
        id: row.id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        staff_id: (row as { staff_id?: string | null }).staff_id ?? null,
        service_id: (row as { service_id?: string | null }).service_id ?? null,
        start_time: row.start_time,
        end_time: row.end_time,
        status: row.status,
        source,
        booking_reference:
          (row as { booking_reference?: string | null }).booking_reference ??
          null,
        call_log_id: (row as { call_log_id?: string | null }).call_log_id ?? null,
        ai_booking_notes:
          (row as { ai_booking_notes?: string | null }).ai_booking_notes ?? null,
        confirmation_sms_sent_at:
          (row as { confirmation_sms_sent_at?: string | null })
            .confirmation_sms_sent_at ?? null,
        reminder_sent_at:
          (row as { reminder_sent_at?: string | null }).reminder_sent_at ?? null,
        reminder_email_sent_at:
          (row as { reminder_email_sent_at?: string | null })
            .reminder_email_sent_at ?? null,
        customer_email:
          (row as { customer_email?: string | null }).customer_email ?? null,
        confirmation_email_sent_at:
          (row as { confirmation_email_sent_at?: string | null })
            .confirmation_email_sent_at ?? null,
        payment_status:
          (row as { payment_status?: string | null }).payment_status ?? null,
        amount_cents:
          (row as { amount_cents?: number | null }).amount_cents ?? null,
        service_total_cents:
          (row as { service_total_cents?: number | null })
            .service_total_cents ?? null,
        deposit_cents:
          (row as { deposit_cents?: number | null }).deposit_cents ?? null,
        balance_due_cents:
          (row as { balance_due_cents?: number | null }).balance_due_cents ??
          null,
        currency:
          (row as { currency?: string | null }).currency ?? null,
        paid_at:
          (row as { paid_at?: string | null }).paid_at ?? null,
        payment_link_sent_at:
          (row as { payment_link_sent_at?: string | null })
            .payment_link_sent_at ?? null,
        stripe_checkout_session_id:
          (row as { stripe_checkout_session_id?: string | null })
            .stripe_checkout_session_id ?? null,
        cancel_reason:
          (row as { cancel_reason?: string | null }).cancel_reason ?? null,
        cancelled_at:
          (row as { cancelled_at?: string | null }).cancelled_at ?? null,
        series_id:
          (row as { series_id?: string | null }).series_id ?? null,
        recurrence_rule:
          (row as { recurrence_rule?: string | null }).recurrence_rule ?? null,
        services: Array.isArray(row.services)
          ? row.services[0] ?? null
          : row.services ?? null,
      };
    }
  );

  const services: ServiceOption[] = (serviceRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    price: Number(s.price),
    duration_minutes: s.duration_minutes,
  }));

  const staff: { id: string; name: string }[] = (staffRows ?? []).map((r) => ({
    id: r.id as string,
    name: ((r.name as string | null) ?? "").trim() || "Staff",
  }));

  const minBookingDateYmd = formatInTimeZone(
    new Date(),
    getReminderTimezone(),
    "yyyy-MM-dd",
  );

  return (
    <div className="-mx-6 -mt-8 flex h-full min-h-0 flex-1 flex-col bg-gray-50/30 lg:-mx-12">
      {apptError ? (
        <div className="mx-auto max-w-2xl px-6 py-8 lg:px-12">
          <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-red-700">
              Could not load appointments
            </p>
            <p className="mt-2 text-sm text-gray-600">{apptError.message}</p>
          </div>
        </div>
      ) : (
        <BookingsView
          appointments={appointments}
          services={services}
          staff={staff}
          minBookingDateYmd={minBookingDateYmd}
        />
      )}
    </div>
  );
}
