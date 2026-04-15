import { redirect } from "next/navigation";

import type { CalendarAppointment } from "@/lib/calendar-appointment";
import {
  MOCK_CALENDAR_STAFF,
  type CalendarStaffMember,
} from "@/lib/calendar-staff";
import { requireDashboardSession } from "@/lib/dashboard-session";

import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

/** Load appointments overlapping this window (any slot that could touch the grid). */
function calendarQueryRange(): { from: Date; to: Date } {
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export default async function CalendarPage() {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("tier")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgRow?.tier !== "native") {
    redirect("/dashboard");
  }

  const { from, to } = calendarQueryRange();

  const staffQuery = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("organization_id", organizationId)
    .in("role", ["staff", "admin"])
    .order("name", { ascending: true });

  const staffMembers: CalendarStaffMember[] =
    staffQuery.error || !staffQuery.data?.length
      ? MOCK_CALENDAR_STAFF
      : staffQuery.data.map((r) => ({
          id: r.id,
          name: (r.name?.trim() || "Staff").trim(),
        }));

  const apptSelect = `
      id,
      customer_name,
      start_time,
      end_time,
      status,
      source,
      booking_reference,
      staff_id,
      services ( name )
    `;

  type CalendarApptRow = {
    id: string;
    customer_name: string;
    start_time: string;
    end_time: string;
    status: string;
    source: string | null;
    booking_reference?: string | null;
    staff_id?: string | null;
    services: unknown;
  };

  let rows: CalendarApptRow[] | null = null;
  let error: { message: string } | null = null;

  const first = await supabase
    .from("appointments")
    .select(apptSelect)
    .eq("organization_id", organizationId)
    .lt("start_time", to.toISOString())
    .gt("end_time", from.toISOString())
    .order("start_time", { ascending: true });

  if (first.error?.message?.includes("staff_id")) {
    const second = await supabase
      .from("appointments")
      .select(
        `
      id,
      customer_name,
      start_time,
      end_time,
      status,
      source,
      booking_reference,
      services ( name )
    `,
      )
      .eq("organization_id", organizationId)
      .lt("start_time", to.toISOString())
      .gt("end_time", from.toISOString())
      .order("start_time", { ascending: true });
    rows = second.data as CalendarApptRow[] | null;
    error = second.error;
  } else {
    rows = first.data as CalendarApptRow[] | null;
    error = first.error;
  }

  const appointments: CalendarAppointment[] = (rows ?? []).map((row) => {
    const svc = Array.isArray(row.services)
      ? row.services[0]
      : row.services;
    const name =
      svc && typeof svc === "object" && "name" in svc
        ? String((svc as { name: string }).name)
        : "Service";
    const src = row.source;
    const source: CalendarAppointment["source"] =
      src === "ai_call" || src === "booking_link" || src === "dashboard"
        ? src
        : "dashboard";

    const sid = row.staff_id;
    return {
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      customer_name: row.customer_name,
      service_name: name,
      staff_id:
        typeof sid === "string" && sid.trim() ? sid.trim() : null,
      booking_reference:
        typeof row.booking_reference === "string"
          ? row.booking_reference
          : undefined,
      status: row.status as CalendarAppointment["status"],
      source,
    };
  });

  return (
    <div className="-mx-5 -mt-8 flex min-h-0 flex-1 flex-col overflow-hidden bg-white sm:-mx-8 lg:-mx-10 xl:-mx-12">
      {error ? (
        <div className="mx-auto max-w-2xl px-6 py-8 lg:px-12">
          <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <p className="text-sm font-semibold text-red-700">
              Could not load calendar
            </p>
            <p className="mt-2 text-sm text-zinc-600">{error.message}</p>
          </div>
        </div>
      ) : (
        <CalendarView
          appointments={appointments}
          staffMembers={staffMembers}
        />
      )}
    </div>
  );
}
