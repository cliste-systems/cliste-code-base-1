import type { Metadata } from "next";
import { Shield } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import {
  ADMIN_LIST_PAGE_CLASS,
  AdminListCard,
} from "@/components/admin/admin-list-card";
import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import {
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";
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

  const authCountLabel = `${rows.length} event${rows.length === 1 ? "" : "s"}`;

  return (
    <AdminPageShell
      icon={Shield}
      title="Security"
      description="Track successful and failed logins, where attempts come from, and repeated attempts over time."
      className={ADMIN_LIST_PAGE_CLASS}
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
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AdminStatCard label="Failed attempts (24h)" value={failures24h} />
            <AdminStatCard label="Successful auths (24h)" value={success24h} />
            <AdminStatCard label="Unique IPs (24h)" value={uniqueIps24h} />
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <AdminSectionCard
            title="Repeated attempts"
            description="Failed or rate-limited identities with the highest counts."
            padded
          >
            {topAttempts.length === 0 ? (
              <p className="text-sm text-gray-500">
                No failed or rate-limited attempts recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {topAttempts.map(([who, count]) => (
                  <li
                    key={who}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="truncate text-gray-700">{who}</span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminSectionCard>

          <AdminListCard countLabel={authCountLabel}>
            <table className={`${adminTableClass} min-w-[1080px] text-sm`}>
              <thead className={adminTableHeadClass}>
                <tr>
                  <th className={adminTableThClass}>When</th>
                  <th className={adminTableThClass}>Event</th>
                  <th className={adminTableThClass}>Outcome</th>
                  <th className={adminTableThClass}>Login email</th>
                  <th className={adminTableThClass}>Actor</th>
                  <th className={adminTableThClass}>Target</th>
                  <th className={adminTableThClass}>IP / Country</th>
                  <th className={adminTableThClass}>Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={adminTableEmptyClass}>
                      No security events recorded yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={adminTableRowClass}>
                      <td className={`text-gray-700 ${adminTableTdClass}`}>
                        {formatDate(row.created_at)}
                      </td>
                      <td className={`text-gray-700 ${adminTableTdClass}`}>
                        {row.event_type}
                      </td>
                      <td className={adminTableTdClass}>
                        <AdminBadge>{outcomeLabel(row.outcome)}</AdminBadge>
                      </td>
                      <td className={`text-gray-700 ${adminTableTdClass}`}>
                        {row.login_email ?? "—"}
                      </td>
                      <td className={`text-gray-700 ${adminTableTdClass}`}>
                        {row.actor_email ?? "—"}
                      </td>
                      <td className={`text-gray-700 ${adminTableTdClass}`}>
                        {row.target_email ?? "—"}
                      </td>
                      <td className={`text-gray-700 ${adminTableTdClass}`}>
                        {row.ip_masked ?? "—"}
                        {row.ip_country ? ` (${row.ip_country})` : ""}
                      </td>
                      <td className={`text-gray-700 ${adminTableTdClass}`}>
                        {row.attempt_count ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </AdminListCard>

          {pipelineIncidents.length > 0 ? (
            <AdminSectionCard
              title="Voice pipeline health"
              description="Unrecoverable STT/LLM/TTS failures reported by the worker."
              contentClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className={`${adminTableClass} min-w-[720px] text-sm`}>
                  <thead className={adminTableHeadClass}>
                    <tr>
                      <th className={adminTableThClass}>When</th>
                      <th className={adminTableThClass}>Stage</th>
                      <th className={adminTableThClass}>DID</th>
                      <th className={adminTableThClass}>Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pipelineIncidents.map((inc) => (
                      <tr key={inc.id} className={adminTableRowClass}>
                        <td className={`whitespace-nowrap text-gray-600 ${adminTableTdClass}`}>
                          {formatDate(inc.occurred_at)}
                        </td>
                        <td className={`font-medium text-gray-900 ${adminTableTdClass}`}>
                          {inc.stage}
                        </td>
                        <td className={`text-gray-600 ${adminTableTdClass}`}>
                          {inc.called_number ?? "—"}
                        </td>
                        <td className={`max-w-md truncate text-gray-700 ${adminTableTdClass}`}>
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
            contentClassName="p-0"
          >
            {complianceError ? (
              <p className="px-4 py-3 text-sm text-gray-700">
                Compliance events unavailable: {complianceError}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className={`${adminTableClass} min-w-[720px] text-sm`}>
                  <thead className={adminTableHeadClass}>
                    <tr>
                      <th className={adminTableThClass}>When</th>
                      <th className={adminTableThClass}>Event</th>
                      <th className={adminTableThClass}>Organization</th>
                      <th className={adminTableThClass}>Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {complianceRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={adminTableEmptyClass}>
                          No compliance events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      complianceRows.map((row) => (
                        <tr key={row.id} className={adminTableRowClass}>
                          <td className={`text-gray-700 ${adminTableTdClass}`}>
                            {formatDate(row.created_at)}
                          </td>
                          <td className={`text-gray-700 ${adminTableTdClass}`}>
                            {row.event_type}
                          </td>
                          <td className={`font-mono text-xs text-gray-600 ${adminTableTdClass}`}>
                            {row.organization_id ?? "—"}
                          </td>
                          <td className={`text-xs text-gray-600 ${adminTableTdClass}`}>
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
        </>
      )}
    </AdminPageShell>
  );
}
