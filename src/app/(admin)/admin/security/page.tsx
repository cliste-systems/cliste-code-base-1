import type { Metadata } from "next";
import { Shield } from "lucide-react";

import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { PRODUCT_NAME } from "@/lib/company-details";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Security`,
};

type SecurityEventRow = {
  id: number;
  created_at: string;
  event_type: string;
  outcome: "success" | "failure" | "rate_limited" | "config_error" | string;
  actor_email: string | null;
  target_email: string | null;
  login_email: string | null;
  ip_masked: string | null;
  ip_country: string | null;
  attempt_count: number | null;
  metadata: Record<string, unknown> | null;
};

function outcomeLabel(outcome: SecurityEventRow["outcome"]): string {
  switch (outcome) {
    case "success":
      return "Success";
    case "failure":
      return "Failed";
    case "rate_limited":
      return "Rate limited";
    case "config_error":
      return "Config error";
    default:
      return outcome;
  }
}

function outcomeClass(outcome: SecurityEventRow["outcome"]): string {
  switch (outcome) {
    case "success":
      return "border-green-200/60 bg-green-50 text-green-700";
    case "failure":
      return "border-red-200/60 bg-red-50 text-red-700";
    case "rate_limited":
      return "border-amber-200/80 bg-amber-50 text-amber-800";
    default:
      return "border-gray-200/80 bg-gray-50 text-gray-700";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type ComplianceEventRow = {
  id: string;
  created_at: string;
  event_type: string;
  organization_id: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function AdminSecurityPage() {
  let loadError: string | null = null;
  let rows: SecurityEventRow[] = [];
  let complianceRows: ComplianceEventRow[] = [];
  let complianceError: string | null = null;
  let pipelineIncidents: {
    id: string;
    occurred_at: string;
    stage: string;
    error_message: string;
    called_number: string | null;
  }[] = [];
  let disclosureConfirmedPct: number | null = null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("security_auth_events")
      .select(
        "id, created_at, event_type, outcome, actor_email, target_email, login_email, ip_masked, ip_country, attempt_count, metadata"
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as SecurityEventRow[];

    const complianceRes = await admin
      .from("compliance_events")
      .select("id, created_at, event_type, organization_id, metadata")
      .order("created_at", { ascending: false })
      .limit(100);
    if (complianceRes.error) {
      complianceError = complianceRes.error.message;
    } else {
      complianceRows = (complianceRes.data ?? []) as ComplianceEventRow[];
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: callRows } = await admin
      .from("call_logs")
      .select("id")
      .gte("created_at", weekAgo);
    const { count: disclosureMisses } = await admin
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "voice_disclosure_not_confirmed")
      .gte("created_at", weekAgo);
    const totalCalls = callRows?.length ?? 0;
    if (totalCalls > 0) {
      const misses = disclosureMisses ?? 0;
      disclosureConfirmedPct = Math.round(
        ((totalCalls - misses) / totalCalls) * 100,
      );
    }

    const { data: incidents } = await admin
      .from("voice_pipeline_incidents")
      .select("id, occurred_at, stage, error_message, called_number")
      .gte("occurred_at", weekAgo)
      .order("occurred_at", { ascending: false })
      .limit(20);
    pipelineIncidents = (incidents ?? []) as typeof pipelineIncidents;
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load security events.";
  }

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const failures24h = rows.filter(
    (r) =>
      (r.outcome === "failure" || r.outcome === "rate_limited") &&
      new Date(r.created_at).getTime() >= dayAgo
  ).length;
  const success24h = rows.filter(
    (r) =>
      r.outcome === "success" && new Date(r.created_at).getTime() >= dayAgo
  ).length;
  const uniqueIps24h = new Set(
    rows
      .filter((r) => new Date(r.created_at).getTime() >= dayAgo)
      .map((r) => r.ip_masked || "unknown")
  ).size;

  const attemptsByIdentity = new Map<string, number>();
  for (const row of rows) {
    if (row.outcome !== "failure" && row.outcome !== "rate_limited") continue;
    const who = row.login_email || row.actor_email || row.ip_masked || "unknown";
    attemptsByIdentity.set(who, (attemptsByIdentity.get(who) ?? 0) + 1);
  }
  const topAttempts = [...attemptsByIdentity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <AdminPageShell
      icon={Shield}
      title="Security"
      description="Track successful and failed logins, where attempts come from, and repeated attempts over time."
    >
      {loadError ? (
        <AdminErrorCard
          message={loadError}
          hint={
            <p className="text-xs text-red-700/80">
              If this is a missing-table error, run the latest Supabase migration.
            </p>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminStatCard label="Failed attempts (24h)" value={failures24h} />
            <AdminStatCard label="Successful auths (24h)" value={success24h} />
            <AdminStatCard label="Unique IPs (24h)" value={uniqueIps24h} />
          </section>

          <AdminSectionCard title="Repeated attempts" padded>
            {topAttempts.length === 0 ? (
              <p className="text-sm text-gray-500">
                No failed or rate-limited attempts recorded yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {topAttempts.map(([who, count]) => (
                  <li
                    key={who}
                    className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-gray-700">{who}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminSectionCard>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AdminStatCard
              label="Disclosure confirmed (7d)"
              value={
                disclosureConfirmedPct != null
                  ? `${disclosureConfirmedPct}%`
                  : "—"
              }
            />
            <AdminStatCard
              label="Pipeline incidents (7d)"
              value={pipelineIncidents.length}
            />
          </section>

          {pipelineIncidents.length > 0 ? (
            <AdminSectionCard
              title="Voice pipeline health"
              description="Unrecoverable STT/LLM/TTS failures reported by the worker."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white">
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        When
                      </th>
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        Stage
                      </th>
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        DID
                      </th>
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pipelineIncidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-gray-50/40">
                        <td className="px-5 py-4 whitespace-nowrap text-gray-600">
                          {formatDate(inc.occurred_at)}
                        </td>
                        <td className="px-5 py-4 font-medium text-gray-900">
                          {inc.stage}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {inc.called_number ?? "—"}
                        </td>
                        <td className="max-w-md truncate px-5 py-4 text-gray-700">
                          {inc.error_message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminSectionCard>
          ) : null}

          <AdminSectionCard
            title="Voice compliance signals"
            description="Disclosure misses and other compliance telemetry from the voice pipeline."
          >
            {complianceError ? (
              <p className="text-sm text-amber-800">
                Compliance events unavailable: {complianceError}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white">
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        When
                      </th>
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        Event
                      </th>
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        Organization
                      </th>
                      <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                        Metadata
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {complianceRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-12 text-center text-sm text-gray-500"
                        >
                          No compliance events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      complianceRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/40">
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {formatDate(row.created_at)}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {row.event_type}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-gray-600">
                            {row.organization_id ?? "—"}
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-600">
                            {row.metadata
                              ? JSON.stringify(row.metadata).slice(0, 120)
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSectionCard>

          <AdminSectionCard
            title="Auth events"
            description="Recent login and access activity across the platform."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      When
                    </th>
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      Event
                    </th>
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      Outcome
                    </th>
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      Login email
                    </th>
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      Actor
                    </th>
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      Target
                    </th>
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      IP / Country
                    </th>
                    <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                      Attempts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-12 text-center text-sm text-gray-500"
                      >
                        No security events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/40">
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {row.event_type}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${outcomeClass(row.outcome)}`}
                          >
                            {outcomeLabel(row.outcome)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {row.login_email ?? "—"}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {row.actor_email ?? "—"}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {row.target_email ?? "—"}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {row.ip_masked ?? "—"}
                          {row.ip_country ? ` (${row.ip_country})` : ""}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {row.attempt_count ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AdminSectionCard>
        </>
      )}
    </AdminPageShell>
  );
}
