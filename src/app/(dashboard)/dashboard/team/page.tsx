import { redirect } from "next/navigation";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { parseStorefrontTeamMembers, type StorefrontTeamMember } from "@/lib/storefront-blocks";

import { TeamView, type TeamMemberRecord, type TeamServiceOption } from "./team-view";

export const dynamic = "force-dynamic";

/**
 * Per-stylist scheduling page (Phase 1):
 *  - weekly working hours
 *  - upcoming time off
 *  - which services they perform
 *
 * Storefront photos / bios still live on /dashboard/services so the
 * legacy team-cards block keeps working untouched.
 */
export default async function DashboardTeamPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select("tier, storefront_team_members")
    .eq("id", organizationId)
    .maybeSingle();
  if (org?.tier !== "native") {
    redirect("/dashboard");
  }

  // The storefront column may be missing on older databases — treat that as
  // "no showcase yet" rather than crashing the whole team page.
  const showcase: StorefrontTeamMember[] = parseStorefrontTeamMembers(
    (org as { storefront_team_members?: unknown } | null)
      ?.storefront_team_members ?? null,
  );

  const [
    { data: staffRows, error: staffErr },
    { data: serviceRows, error: svcErr },
    { data: workingRows },
    { data: timeOffRows },
    { data: staffServiceRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, role")
      .eq("organization_id", organizationId)
      .in("role", ["staff", "admin"])
      .order("name", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase
      .from("staff_working_hours")
      .select("id, staff_id, weekday, opens_at, closes_at")
      .eq("organization_id", organizationId)
      .order("weekday", { ascending: true })
      .order("opens_at", { ascending: true }),
    (() => {
      // eslint-disable-next-line react-hooks/purity -- server component; deterministic per request
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return supabase
        .from("staff_time_off")
        .select("id, staff_id, starts_at, ends_at, reason")
        .eq("organization_id", organizationId)
        .gte("ends_at", sinceIso)
        .order("starts_at", { ascending: true });
    })(),
    supabase
      .from("staff_services")
      .select("staff_id, service_id")
      .eq("organization_id", organizationId),
  ]);

  if (staffErr || svcErr) {
    return (
      <div className="-mx-6 -mt-8 flex min-h-0 flex-1 flex-col bg-gray-50 px-6 py-8 lg:-mx-12 lg:px-12">
        <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-red-700">
            Could not load team
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {staffErr?.message ?? svcErr?.message ?? "Unknown error."}
          </p>
        </div>
      </div>
    );
  }

  const services: TeamServiceOption[] = (serviceRows ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? "Service",
    durationMinutes: Number(s.duration_minutes ?? 0),
  }));

  const team: TeamMemberRecord[] = (staffRows ?? []).map((staff) => {
    const id = staff.id as string;
    const name = (staff.name as string | null)?.trim() || "Unnamed staff";
    const workingHours =
      (workingRows ?? [])
        .filter((w) => w.staff_id === id)
        .map((w) => ({
          id: w.id as string,
          weekday: Number(w.weekday),
          opensAt: String(w.opens_at).slice(0, 5),
          closesAt: String(w.closes_at).slice(0, 5),
        }));
    const timeOff =
      (timeOffRows ?? [])
        .filter((t) => t.staff_id === id)
        .map((t) => ({
          id: t.id as string,
          startsAt: String(t.starts_at),
          endsAt: String(t.ends_at),
          reason: (t.reason as string | null) ?? null,
        }));
    const serviceIds = (staffServiceRows ?? [])
      .filter((r) => r.staff_id === id)
      .map((r) => String(r.service_id));
    return {
      id,
      name,
      role: (staff.role as string) ?? "staff",
      workingHours,
      timeOff,
      serviceIds,
    };
  });

  return (
    <div className="-mx-6 -mt-8 flex h-full min-h-0 flex-1 flex-col bg-gray-50 lg:-mx-12">
      <TeamView team={team} services={services} showcase={showcase} />
    </div>
  );
}
