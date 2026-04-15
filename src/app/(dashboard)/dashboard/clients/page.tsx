import type { ClientDisplay } from "@/lib/client-types";
import { requireDashboardSession } from "@/lib/dashboard-session";

import { ClientsView } from "./clients-view";

type ProfileRow = {
  id: string;
  name: string | null;
  created_at: string;
};

type ApptRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  status: string;
  services: unknown;
};

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatLastVisitShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function serviceNameFromJoin(services: unknown): string {
  const s = Array.isArray(services) ? services[0] : services;
  if (s && typeof s === "object" && "name" in s) {
    return String((s as { name: string }).name);
  }
  return "Appointment";
}

/** Digits only — same person regardless of spaces, +, or formatting. */
function normalizePhoneKey(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

function enrichFromAppointments(
  profile: ProfileRow,
  appointments: ApptRow[],
): ClientDisplay {
  const displayName = profile.name?.trim() || "Unnamed client";
  const key = normName(displayName);

  const matching =
    displayName === "Unnamed client"
      ? []
      : appointments.filter((a) => normName(a.customer_name) === key);

  const active = matching.filter((a) => a.status !== "cancelled");
  const sorted = [...active].sort(
    (a, b) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );

  const totalBookings = active.length;
  const rawPhone = sorted[0]?.customer_phone?.trim();
  const phone =
    rawPhone && rawPhone.length > 0 ? rawPhone : "—";

  const lastVisitLabel =
    sorted.length > 0 ? formatLastVisitShort(sorted[0].start_time) : "—";

  const history = sorted.map((a) => ({
    id: a.id,
    dateLabel: formatLastVisitShort(a.start_time),
    service: serviceNameFromJoin(a.services),
  }));

  return {
    id: profile.id,
    name: displayName,
    phone,
    totalBookings,
    noShows: 0,
    lastVisitLabel,
    history,
    canDelete: true,
  };
}

function buildGuestClientsFromAppointments(
  appointments: ApptRow[],
): ClientDisplay[] {
  const byKey = new Map<string, ApptRow[]>();
  for (const a of appointments) {
    const key = normalizePhoneKey(a.customer_phone);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(a);
    byKey.set(key, list);
  }

  const out: (ClientDisplay & { _sort: number })[] = [];

  for (const [phoneKey, rows] of byKey) {
    const active = rows.filter((a) => a.status !== "cancelled");
    if (active.length === 0) continue;

    const sorted = [...active].sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    );
    const primary = sorted[0]!;
    const name = primary.customer_name?.trim() || "Guest";
    const phone = primary.customer_phone?.trim() || "—";

    const history = sorted.map((a) => ({
      id: a.id,
      dateLabel: formatLastVisitShort(a.start_time),
      service: serviceNameFromJoin(a.services),
    }));

    const lastTs = new Date(sorted[0]!.start_time).getTime();

    out.push({
      id: `guest:${phoneKey}`,
      name,
      phone,
      totalBookings: active.length,
      noShows: 0,
      lastVisitLabel: formatLastVisitShort(sorted[0]!.start_time),
      history,
      canDelete: false,
      _sort: lastTs,
    });
  }

  return out
    .sort((a, b) => b._sort - a._sort)
    .map(({ _sort, ...c }) => c);
}

function mergeProfileAndGuestClients(
  profiles: ProfileRow[],
  appointments: ApptRow[],
  guests: ClientDisplay[],
): ClientDisplay[] {
  const startByApptId = new Map(
    appointments.map((a) => [a.id, new Date(a.start_time).getTime()] as const),
  );

  const latestVisitTs = (c: ClientDisplay): number => {
    let max = 0;
    for (const h of c.history) {
      const t = startByApptId.get(h.id);
      if (t !== undefined && t > max) max = t;
    }
    return max;
  };

  const guestByPhone = new Map<string, ClientDisplay>();
  for (const g of guests) {
    const key = normalizePhoneKey(g.phone);
    if (key) guestByPhone.set(key, g);
  }

  const merged: ClientDisplay[] = [];
  const consumedPhones = new Set<string>();

  for (const p of profiles) {
    const enriched = enrichFromAppointments(p, appointments);
    const pk = normalizePhoneKey(enriched.phone);
    if (pk && guestByPhone.has(pk) && enriched.totalBookings > 0) {
      consumedPhones.add(pk);
      merged.push({
        ...enriched,
        id: p.id,
        canDelete: true,
      });
    } else {
      merged.push(enriched);
    }
  }

  for (const g of guests) {
    const pk = normalizePhoneKey(g.phone);
    if (pk && consumedPhones.has(pk)) continue;
    merged.push(g);
  }

  return merged.sort((a, b) => latestVisitTs(b) - latestVisitTs(a));
}

export default async function ClientsPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const [
    { data: profileRows, error: profileError },
    { data: apptRows, error: apptError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, created_at")
      .eq("organization_id", organizationId)
      .eq("role", "customer")
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select(
        `
          id,
          customer_name,
          customer_phone,
          start_time,
          status,
          services (
            name
          )
        `,
      )
      .eq("organization_id", organizationId),
  ]);

  const appts = (apptRows ?? []) as ApptRow[];

  const guests = buildGuestClientsFromAppointments(appts);

  const clients: ClientDisplay[] = mergeProfileAndGuestClients(
    (profileRows ?? []) as ProfileRow[],
    appts,
    guests,
  );

  return (
    <div className="-mx-6 -mt-8 flex h-full min-h-0 flex-1 flex-col bg-gray-50 lg:-mx-12">
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
        <ClientsView
          clients={clients}
          profileLoadError={profileError?.message ?? null}
        />
      )}
    </div>
  );
}
