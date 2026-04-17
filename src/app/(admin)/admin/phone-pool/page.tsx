import { Phone } from "lucide-react";

import { poolHealthCheck, twilioIsConfigured } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";

import { TriggerRefillButton } from "./refill-button";

export const dynamic = "force-dynamic";

type PoolRow = {
  id: string;
  e164: string;
  country_code: string;
  provider: string;
  status: string;
  organization_id: string | null;
  assigned_at: string | null;
  cooldown_until: string | null;
  notes: string | null;
};

export default async function PhonePoolAdminPage() {
  const health = await poolHealthCheck();
  const admin = createAdminClient();

  const { data } = await admin
    .from("phone_numbers")
    .select(
      "id, e164, country_code, provider, status, organization_id, assigned_at, cooldown_until, notes",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as PoolRow[];

  const orgIds = [
    ...new Set(rows.map((r) => r.organization_id).filter(Boolean) as string[]),
  ];
  const orgNameIndex = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);
    for (const o of orgs ?? []) {
      orgNameIndex.set(o.id as string, (o.name as string | null) ?? "(unnamed)");
    }
  }

  const twilioReady = twilioIsConfigured();

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Phone className="h-5 w-5 text-gray-500" /> Phone pool
          </h1>
          <p className="text-sm text-gray-500">
            Irish DIDs Cliste owns. Pool refills nightly when IE-available drops
            below the low-water mark.
          </p>
        </div>
        <TriggerRefillButton />
      </header>

      {!twilioReady ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Twilio credentials are not configured — pool refill is a no-op. Set
          <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">TWILIO_ACCOUNT_SID</code>
          and
          <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">TWILIO_AUTH_TOKEN</code>
          to enable automated purchases.
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Available (IE)" value={health.availableIE} />
        <Stat label="Available (other)" value={health.availableOther} />
        <Stat label="Assigned" value={health.assigned} />
        <Stat label="Cooldown" value={health.cooldown} />
        <Stat
          label="Low-water mark"
          value={health.lowWaterMark}
          muted
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Number</th>
              <th className="px-4 py-2 text-left">Provider</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Assigned to</th>
              <th className="px-4 py-2 text-left">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Pool is empty. Trigger a refill or seed numbers manually.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono">
                    {r.e164}
                    <span className="ml-2 inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {r.country_code}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{r.provider}</td>
                  <td className="px-4 py-2">
                    <StatusChip status={r.status} />
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {r.organization_id
                      ? (orgNameIndex.get(r.organization_id) ?? "(linked)")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {formatAgeLabel(r)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p
        className={
          muted
            ? "mt-2 text-xl font-semibold text-gray-500"
            : "mt-2 text-xl font-semibold text-gray-900"
        }
      >
        {value.toLocaleString("en-IE")}
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "available"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "assigned"
        ? "bg-blue-50 text-blue-700 ring-blue-200"
        : status === "cooldown"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : status === "porting_out"
            ? "bg-red-50 text-red-700 ring-red-200"
            : "bg-gray-100 text-gray-700 ring-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

function formatAgeLabel(r: PoolRow): string {
  const iso = r.status === "cooldown" ? r.cooldown_until : r.assigned_at;
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IE", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
