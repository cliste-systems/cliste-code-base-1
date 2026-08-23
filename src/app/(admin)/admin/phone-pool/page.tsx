import { Phone } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { poolHealthCheck, twilioIsConfigured } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";

import { PhonePoolToolbar } from "./refill-button";

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
    <AdminPageShell
      icon={Phone}
      title="Phone pool"
      description="Irish DIDs Cliste owns. Pool refills nightly when IE-available drops below the low-water mark."
      className="space-y-6"
    >
      {!twilioReady ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          Twilio credentials are not configured — pool refill is a no-op. Set{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
            TWILIO_ACCOUNT_SID
          </code>{" "}
          and{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
            TWILIO_AUTH_TOKEN
          </code>{" "}
          to enable automated purchases.
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <AdminStatCard label="Available (IE)" value={health.availableIE.toLocaleString("en-IE")} />
        <AdminStatCard
          label="Available (other)"
          value={health.availableOther.toLocaleString("en-IE")}
        />
        <AdminStatCard label="Assigned" value={health.assigned.toLocaleString("en-IE")} />
        <AdminStatCard label="Cooldown" value={health.cooldown.toLocaleString("en-IE")} />
        <AdminStatCard
          label="Low-water mark"
          value={health.lowWaterMark.toLocaleString("en-IE")}
          muted
        />
      </section>

      <PhonePoolToolbar />

      <AdminSectionCard
        title="All numbers"
        description={`${rows.length} number${rows.length === 1 ? "" : "s"} · newest first`}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/80">
              <tr>
                <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Number
                </th>
                <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Provider
                </th>
                <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Assigned to
                </th>
                <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Since
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-16 text-center text-sm text-gray-500"
                  >
                    Pool is empty. Trigger a refill or seed numbers manually.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono text-sm">
                      {r.e164}
                      <span className="ml-2 inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        {r.country_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.provider}</td>
                    <td className="px-4 py-3">
                      <AdminBadge className="capitalize">{r.status}</AdminBadge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.organization_id
                        ? (orgNameIndex.get(r.organization_id) ?? "(linked)")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatAgeLabel(r)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>
    </AdminPageShell>
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
