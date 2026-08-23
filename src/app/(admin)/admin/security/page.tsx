import type { Metadata } from "next";
import { Shield } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { AdminSegmentedTabs } from "@/components/admin/admin-segmented-tabs";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableTdDateClass,
  adminTableThClass,
  adminTableThDateClass,
  cellOrBlank,
} from "@/components/admin/admin-table";
import { PRODUCT_NAME } from "@/lib/company-details";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Security`,
};

type SecurityView = "auth" | "compliance" | "pipeline";

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

type ComplianceEventRow = {
  id: string;
  created_at: string;
  event_type: string;
  organization_id: string | null;
  metadata: Record<string, unknown> | null;
};

const VIEW_TABS = [
  { value: "auth", label: "Auth events", href: "/admin/security" },
  {
    value: "compliance",
    label: "Compliance",
    href: "/admin/security?view=compliance",
  },
  {
    value: "pipeline",
    label: "Pipeline",
    href: "/admin/security?view=pipeline",
  },
] as const;

function parseSecurityView(raw: string | undefined): SecurityView {
  if (raw === "compliance" || raw === "pipeline") return raw;
  return "auth";
}

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
      return outcome.replace(/_/g, " ");
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEventType(type: string): string {
  return type.replace(/_/g, " ");
}

function primaryIdentity(row: SecurityEventRow): string {
  return (
    cellOrBlank(row.actor_email) ||
    cellOrBlank(row.login_email) ||
    cellOrBlank(row.target_email)
  );
}

function formatIp(row: SecurityEventRow): string {
  const ip = cellOrBlank(row.ip_masked);
  if (!ip) return "";
  return row.ip_country ? `${ip} · ${row.ip_country}` : ip;
}

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = parseSecurityView(viewParam);

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
        "id, created_at, event_type, outcome, actor_email, target_email, login_email, ip_masked, ip_country, attempt_count, metadata",
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
      new Date(r.created_at).getTime() >= dayAgo,
  ).length;
  const success24h = rows.filter(
    (r) =>
      r.outcome === "success" && new Date(r.created_at).getTime() >= dayAgo,
  ).length;
  const uniqueIps24h = new Set(
    rows
      .filter((r) => new Date(r.created_at).getTime() >= dayAgo)
      .map((r) => r.ip_masked || "unknown"),
  ).size;

  const countLabel =
    view === "auth"
      ? `${rows.length} auth event${rows.length === 1 ? "" : "s"}`
      : view === "compliance"
        ? `${complianceRows.length} compliance signal${complianceRows.length === 1 ? "" : "s"}`
        : `${pipelineIncidents.length} pipeline incident${pipelineIncidents.length === 1 ? "" : "s"}`;

  const stats = (
    <AdminStatsGrid>
      <AdminStatCard label="Failed (24h)" value={failures24h} />
      <AdminStatCard label="Successful (24h)" value={success24h} />
      <AdminStatCard label="Unique IPs (24h)" value={uniqueIps24h} />
      <AdminStatCard
        label="Disclosure (7d)"
        value={
          disclosureConfirmedPct != null ? `${disclosureConfirmedPct}%` : "—"
        }
        muted={disclosureConfirmedPct == null}
      />
      <AdminStatCard label="Incidents (7d)" value={pipelineIncidents.length} />
    </AdminStatsGrid>
  );

  return (
    <AdminPageShell
      icon={Shield}
      title="Security"
      description="Auth activity, voice compliance signals, and pipeline health."
      fillViewport
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
        <AdminListCard
          countLabel={countLabel}
          stats={stats}
          toolbar={
            <AdminSegmentedTabs
              tabs={[...VIEW_TABS]}
              activeValue={view}
              ariaLabel="Security view"
            />
          }
        >
          {view === "auth" ? (
            <AuthEventsTable rows={rows} />
          ) : view === "compliance" ? (
            <ComplianceTable rows={complianceRows} error={complianceError} />
          ) : (
            <PipelineTable rows={pipelineIncidents} />
          )}
        </AdminListCard>
      )}
    </AdminPageShell>
  );
}

function AuthEventsTable({ rows }: { rows: SecurityEventRow[] }) {
  return (
    <table className={`${adminTableClass} text-sm`}>
      <thead className={adminTableHeadClass}>
        <tr>
          <th className={adminTableThDateClass}>When</th>
          <th className={adminTableThClass}>Event</th>
          <th className={adminTableThClass}>Outcome</th>
          <th className={adminTableThClass}>Identity</th>
          <th className={adminTableThClass}>IP</th>
        </tr>
      </thead>
      <tbody className={adminTableBodyClass}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className={adminTableEmptyClass}>
              No security events recorded yet.
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const identity = primaryIdentity(row);
            const ip = formatIp(row);
            return (
              <tr key={row.id} className={adminTableRowClass}>
                <td className={adminTableTdDateClass}>
                  {formatWhen(row.created_at)}
                </td>
                <td className={`text-gray-900 ${adminTableTdClass}`}>
                  {formatEventType(row.event_type)}
                </td>
                <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                  <AdminBadge>{outcomeLabel(row.outcome)}</AdminBadge>
                </td>
                <td className={`text-gray-600 ${adminTableTdClass}`}>
                  {identity}
                </td>
                <td className={`text-gray-500 ${adminTableTdClass}`}>
                  {ip}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function ComplianceTable({
  rows,
  error,
}: {
  rows: ComplianceEventRow[];
  error: string | null;
}) {
  if (error) {
    return (
      <p className="px-4 py-8 text-sm text-gray-600">
        Compliance events unavailable: {error}
      </p>
    );
  }

  return (
    <table className={`${adminTableClass} text-sm`}>
      <thead className={adminTableHeadClass}>
        <tr>
          <th className={adminTableThDateClass}>When</th>
          <th className={adminTableThClass}>Event</th>
          <th className={adminTableThClass}>Organization</th>
          <th className={adminTableThClass}>Details</th>
        </tr>
      </thead>
      <tbody className={adminTableBodyClass}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className={adminTableEmptyClass}>
              No compliance events recorded yet.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className={adminTableRowClass}>
              <td className={adminTableTdDateClass}>
                {formatWhen(row.created_at)}
              </td>
              <td className={`text-gray-900 ${adminTableTdClass}`}>
                {formatEventType(row.event_type)}
              </td>
              <td className={`font-mono text-xs text-gray-500 ${adminTableTdClass}`}>
                {cellOrBlank(row.organization_id)}
              </td>
              <td
                className={`max-w-xl truncate text-xs text-gray-600 ${adminTableTdClass}`}
                title={
                  row.metadata ? JSON.stringify(row.metadata) : undefined
                }
              >
                {row.metadata ? JSON.stringify(row.metadata).slice(0, 120) : ""}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PipelineTable({
  rows,
}: {
  rows: {
    id: string;
    occurred_at: string;
    stage: string;
    error_message: string;
    called_number: string | null;
  }[];
}) {
  return (
    <table className={`${adminTableClass} text-sm`}>
      <thead className={adminTableHeadClass}>
        <tr>
          <th className={adminTableThDateClass}>When</th>
          <th className={adminTableThClass}>Stage</th>
          <th className={adminTableThClass}>DID</th>
          <th className={adminTableThClass}>Error</th>
        </tr>
      </thead>
      <tbody className={adminTableBodyClass}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className={adminTableEmptyClass}>
              No pipeline incidents in the last 7 days.
            </td>
          </tr>
        ) : (
          rows.map((inc) => (
            <tr key={inc.id} className={adminTableRowClass}>
              <td className={adminTableTdDateClass}>
                {formatWhen(inc.occurred_at)}
              </td>
              <td className={`font-medium text-gray-900 ${adminTableTdClass}`}>
                {inc.stage}
              </td>
              <td className={`font-mono text-xs text-gray-600 ${adminTableTdClass}`}>
                {cellOrBlank(inc.called_number)}
              </td>
              <td
                className={`max-w-2xl text-gray-700 ${adminTableTdClass}`}
                title={inc.error_message}
              >
                {inc.error_message}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
