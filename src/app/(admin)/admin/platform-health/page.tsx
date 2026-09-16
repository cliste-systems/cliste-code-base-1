import type { Metadata } from "next";
import Link from "next/link";
import { Bug } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
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
import { loadPlatformHealthSnapshot } from "@/lib/platform-health";
import type { PlatformEventRow } from "@/lib/platform-events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Platform health`,
};

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

function severityTone(
  severity: PlatformEventRow["severity"],
): "danger" | "warning" | "success" | "neutral" {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    case "info":
      return "neutral";
    default:
      return "neutral";
  }
}

function severityLabel(severity: PlatformEventRow["severity"]): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
    default:
      return severity;
  }
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

export default async function PlatformHealthPage() {
  let loadError: string | null = null;
  let snapshot: Awaited<ReturnType<typeof loadPlatformHealthSnapshot>> | null =
    null;

  try {
    snapshot = await loadPlatformHealthSnapshot();
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load platform health.";
  }

  const events = snapshot?.events ?? [];
  const missingRecordings = snapshot?.missingRecordings ?? [];
  const critical7d = snapshot?.critical7d ?? 0;
  const warning7d = snapshot?.warning7d ?? 0;

  const stats = (
    <AdminStatsGrid>
      <AdminStatCard
        label="Critical (7d)"
        value={critical7d}
        tone={critical7d > 0 ? "danger" : "neutral"}
      />
      <AdminStatCard
        label="Warnings (7d)"
        value={warning7d}
        tone={warning7d > 0 ? "warning" : "neutral"}
      />
      <AdminStatCard
        label="Missing recordings (7d)"
        value={missingRecordings.length}
        tone={missingRecordings.length > 0 ? "danger" : "neutral"}
      />
      <AdminStatCard label="Events loaded" value={events.length} />
    </AdminStatsGrid>
  );

  return (
    <AdminPageShell
      icon={Bug}
      title="Platform health"
      description="When platform code or infra breaks — failed recordings, webhooks, product lookups, and other worker errors."
      fillViewport
    >
      {loadError ? (
        <AdminErrorCard
          message={loadError}
          hint={
            <p className="text-xs text-red-700/80">
              If this is a missing-table error, run migration{" "}
              <code className="text-xs">109_platform_events.sql</code>.
            </p>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <AdminListCard
            countLabel={`${missingRecordings.length} call${missingRecordings.length === 1 ? "" : "s"} without recording`}
            stats={stats}
          >
            <table className={`${adminTableClass} text-sm`}>
              <thead className={adminTableHeadClass}>
                <tr>
                  <th className={adminTableThDateClass}>When</th>
                  <th className={adminTableThClass}>Tenant</th>
                  <th className={adminTableThClass}>Caller</th>
                  <th className={adminTableThClass}>Duration</th>
                  <th className={adminTableThClass}>Call</th>
                </tr>
              </thead>
              <tbody className={adminTableBodyClass}>
                {missingRecordings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={adminTableEmptyClass}>
                      No recent calls missing a recording.
                    </td>
                  </tr>
                ) : (
                  missingRecordings.map((row) => (
                    <tr key={row.id} className={adminTableRowClass}>
                      <td className={adminTableTdDateClass}>
                        {formatWhen(row.created_at)}
                      </td>
                      <td className={`text-gray-900 ${adminTableTdClass}`}>
                        {cellOrBlank(row.org_name)}
                      </td>
                      <td className={`text-gray-600 ${adminTableTdClass}`}>
                        {cellOrBlank(row.caller_number)}
                      </td>
                      <td className={`tabular-nums text-gray-600 ${adminTableTdClass}`}>
                        {row.duration_seconds}s
                      </td>
                      <td className={adminTableTdClass}>
                        <Link
                          href={`/admin/post-call-health?call=${row.id}`}
                          className="text-sm font-medium text-emerald-700 hover:underline"
                        >
                          View call
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </AdminListCard>

          <AdminListCard
            countLabel={`${events.length} platform event${events.length === 1 ? "" : "s"}`}
          >
            <table className={`${adminTableClass} text-sm`}>
              <thead className={adminTableHeadClass}>
                <tr>
                  <th className={adminTableThDateClass}>When</th>
                  <th className={adminTableThClass}>Severity</th>
                  <th className={adminTableThClass}>Category</th>
                  <th className={adminTableThClass}>Event</th>
                  <th className={adminTableThClass}>Message</th>
                  <th className={adminTableThClass}>Call</th>
                </tr>
              </thead>
              <tbody className={adminTableBodyClass}>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={adminTableEmptyClass}>
                      No platform break events recorded yet.
                    </td>
                  </tr>
                ) : (
                  events.map((row) => (
                    <tr key={row.id} className={adminTableRowClass}>
                      <td className={adminTableTdDateClass}>
                        {formatWhen(row.created_at)}
                      </td>
                      <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                        <AdminBadge tone={severityTone(row.severity)}>
                          {severityLabel(row.severity)}
                        </AdminBadge>
                      </td>
                      <td className={`capitalize text-gray-700 ${adminTableTdClass}`}>
                        {categoryLabel(row.category)}
                      </td>
                      <td className={`font-mono text-xs text-gray-600 ${adminTableTdClass}`}>
                        {row.event_type}
                      </td>
                      <td
                        className={`max-w-xl text-gray-900 ${adminTableTdClass}`}
                        title={row.message}
                      >
                        {row.message}
                      </td>
                      <td className={adminTableTdClass}>
                        {row.call_log_id ? (
                          <Link
                            href={`/admin/post-call-health?call=${row.call_log_id}`}
                            className="text-sm font-medium text-emerald-700 hover:underline"
                          >
                            {row.call_log_id.slice(0, 8)}
                          </Link>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </AdminListCard>
        </div>
      )}
    </AdminPageShell>
  );
}
