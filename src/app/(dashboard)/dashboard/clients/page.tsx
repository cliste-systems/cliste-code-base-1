import type { ClientDisplay } from "@/lib/client-types";
import { requireDashboardSession } from "@/lib/dashboard-session";

import { ClientsView } from "./clients-view";

type ClientRow = {
  id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  notes: string | null;
  allergies: string | null;
  total_visits: number | null;
  no_show_count: number | null;
  last_visit_at: string | null;
};

type ApptRow = {
  id: string;
  client_id: string | null;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  status: string;
  services: unknown;
};

function formatLastVisitShort(iso: string | null): string {
  if (!iso) return "—";
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
  if (s && typeof s === "object" && s !== null && "name" in s) {
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

function buildCanonicalClient(
  row: ClientRow,
  appointments: ApptRow[],
): ClientDisplay {
  const linked = appointments.filter((a) => a.client_id === row.id);
  const sorted = [...linked].sort(
    (a, b) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );
  const history = sorted.map((a) => ({
    id: a.id,
    dateLabel: formatLastVisitShort(a.start_time),
    service: serviceNameFromJoin(a.services),
    status: a.status,
  }));
  const total =
    typeof row.total_visits === "number" && row.total_visits >= 0
      ? row.total_visits
      : sorted.filter(
          (a) => a.status !== "cancelled" && a.status !== "no_show",
        ).length;
  const noShows =
    typeof row.no_show_count === "number" && row.no_show_count >= 0
      ? row.no_show_count
      : sorted.filter((a) => a.status === "no_show").length;

  return {
    id: `client:${row.id}`,
    clientId: row.id,
    name: row.name || "Unnamed client",
    phone: row.phone_e164 || "—",
    email: row.email,
    notes: row.notes,
    allergies: row.allergies,
    totalBookings: total,
    noShows,
    lastVisitLabel: formatLastVisitShort(row.last_visit_at),
    history,
    canDelete: true,
  };
}

function buildLegacyGuestClients(
  appointments: ApptRow[],
  takenPhoneKeys: Set<string>,
): ClientDisplay[] {
  const byKey = new Map<string, ApptRow[]>();
  for (const a of appointments) {
    if (a.client_id) continue;
    const key = normalizePhoneKey(a.customer_phone);
    if (!key) continue;
    if (takenPhoneKeys.has(key)) continue;
    const list = byKey.get(key) ?? [];
    list.push(a);
    byKey.set(key, list);
  }

  const out: (ClientDisplay & { _sort: number })[] = [];

  for (const [phoneKey, rows] of byKey) {
    const sorted = [...rows].sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    );
    const primary = sorted[0]!;
    const name = primary.customer_name?.trim() || "Guest";
    const phone = primary.customer_phone?.trim() || "—";
    const totalBookings = sorted.filter(
      (a) => a.status !== "cancelled" && a.status !== "no_show",
    ).length;
    const noShows = sorted.filter((a) => a.status === "no_show").length;

    const history = sorted.map((a) => ({
      id: a.id,
      dateLabel: formatLastVisitShort(a.start_time),
      service: serviceNameFromJoin(a.services),
      status: a.status,
    }));

    out.push({
      id: `guest:${phoneKey}`,
      clientId: null,
      name,
      phone,
      email: null,
      notes: null,
      allergies: null,
      totalBookings,
      noShows,
      lastVisitLabel: formatLastVisitShort(sorted[0]!.start_time),
      history,
      canDelete: false,
      _sort: new Date(sorted[0]!.start_time).getTime(),
    });
  }

  return out
    .sort((a, b) => b._sort - a._sort)
    .map(({ _sort: _ignored, ...c }) => c);
}

export default async function ClientsPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const [
    { data: clientRows, error: clientError },
    { data: apptRows, error: apptError },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, phone_e164, email, notes, allergies, total_visits, no_show_count, last_visit_at",
      )
      .eq("organization_id", organizationId)
      .order("last_visit_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("appointments")
      .select(
        `
          id,
          client_id,
          customer_name,
          customer_phone,
          start_time,
          status,
          services (
            name
          )
        `,
      )
      .eq("organization_id", organizationId)
      .order("start_time", { ascending: false })
      .limit(2000),
  ]);

  const appts = (apptRows ?? []) as ApptRow[];
  const clients = (clientRows ?? []) as ClientRow[];

  const canonical = clients.map((c) => buildCanonicalClient(c, appts));

  const takenPhoneKeys = new Set<string>();
  for (const c of clients) {
    const k = normalizePhoneKey(c.phone_e164);
    if (k) takenPhoneKeys.add(k);
  }
  const guests = buildLegacyGuestClients(appts, takenPhoneKeys);

  const merged: ClientDisplay[] = [...canonical, ...guests].sort((a, b) => {
    const aLast =
      a.history.length > 0 ? new Date(a.history[0].dateLabel).getTime() : 0;
    const bLast =
      b.history.length > 0 ? new Date(b.history[0].dateLabel).getTime() : 0;
    return bLast - aLast;
  });

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
          clients={merged}
          profileLoadError={clientError?.message ?? null}
        />
      )}
    </div>
  );
}
