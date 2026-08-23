import {
  adminGlobalMetricPeriodRangeLabel,
  adminGlobalMetricPeriodShortLabel,
  getAdminGlobalMetricRange,
  parseAdminGlobalMetricPeriod,
} from "@/lib/admin-metric-range";
import { sumBillableMinutesFromDurations } from "@/lib/billable-minutes";
import { OUTCOME_LABELS, normalizeCallOutcome } from "@/lib/call-history-types";
import { buildHomeCallOutcomeSegments } from "@/lib/dashboard-home-analytics";
import { formatDashboardFeedRelativeTime } from "@/lib/dashboard-feed-time";
import { createAdminClient } from "@/utils/supabase/admin";
import { formatMinutes } from "@/app/(dashboard)/dashboard/billing/usage-helpers";

import { AdminGlobalMetricsBoard } from "./admin-global-metrics-board";
import { AdminTenantsPanel } from "./admin-tenants-panel";
import { loadProvisioningStagesByOrgId } from "@/lib/load-provisioning-pipeline";

export const dynamic = "force-dynamic";

function embeddedOrgName(
  org: { name: string } | { name: string }[] | null,
): string {
  if (!org) return "Unknown tenant";
  const row = Array.isArray(org) ? org[0] : org;
  return row?.name?.trim() || "Unknown tenant";
}

type AdminHomePageProps = {
  searchParams?: Promise<{ period?: string }>;
};

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const sp = searchParams ? await searchParams : {};
  const metricPeriod = parseAdminGlobalMetricPeriod(sp.period);
  const { startIso: rangeStartIso, endExclusiveIso: rangeEndExclusiveIso } =
    getAdminGlobalMetricRange(metricPeriod);
  const periodShort = adminGlobalMetricPeriodShortLabel(metricPeriod);
  const periodRangeLabel = adminGlobalMetricPeriodRangeLabel(metricPeriod);

  let orgCount = 0;
  let callsInRange = 0;
  let openSupportTickets = 0;
  let pipelineIncidents7d = 0;
  let authFailures24h = 0;
  let minutesInRange = 0;
  let callOutcomes = buildHomeCallOutcomeSegments([]);
  let topTenants: { orgId: string; name: string; calls: number }[] = [];
  let recentCalls: {
    id: string;
    orgName: string;
    caller: string;
    outcomeLabel: string;
    timeLabel: string;
  }[] = [];
  let organizations: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    niche: string | null;
    created_at: string;
    provisioningStage?: import("@/lib/tenant-provisioning-status").TenantProvisioningStage | null;
  }[] = [];
  let loadError: string | null = null;

  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const admin = createAdminClient();

    const [
      orgsRes,
      callsRes,
      supportRes,
      pipelineRes,
      authFailsRes,
      listRes,
      callsDetailRes,
    ] = await Promise.all([
      admin.from("organizations").select("id", { count: "exact", head: true }),
      admin
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndExclusiveIso),
      admin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin
        .from("voice_pipeline_incidents")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", weekAgoIso),
      admin
        .from("security_auth_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgoIso)
        .in("outcome", ["failure", "rate_limited"]),
      admin
        .from("organizations")
        .select("id, name, slug, tier, niche, created_at")
        .order("created_at", { ascending: false }),
      admin
        .from("call_logs")
        .select(
          "id, outcome, duration_seconds, created_at, caller_number, caller_name, organization_id, organizations ( name )",
        )
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndExclusiveIso)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (orgsRes.error) throw new Error(orgsRes.error.message);
    if (callsRes.error) throw new Error(callsRes.error.message);
    if (listRes.error) throw new Error(listRes.error.message);
    if (callsDetailRes.error) throw new Error(callsDetailRes.error.message);

    orgCount = orgsRes.count ?? 0;
    callsInRange = callsRes.count ?? 0;
    openSupportTickets = supportRes.error ? 0 : (supportRes.count ?? 0);
    pipelineIncidents7d = pipelineRes.error ? 0 : (pipelineRes.count ?? 0);
    authFailures24h = authFailsRes.error ? 0 : (authFailsRes.count ?? 0);
    organizations = listRes.data ?? [];

    const stageByOrg = await loadProvisioningStagesByOrgId(
      organizations.map((o) => o.id),
    );
    organizations = organizations.map((org) => ({
      ...org,
      provisioningStage: stageByOrg.get(org.id) ?? null,
    }));

    type CallDetailRow = {
      id: string;
      outcome: string | null;
      duration_seconds: number | null;
      created_at: string;
      caller_number: string | null;
      caller_name: string | null;
      organization_id: string;
      organizations: { name: string } | { name: string }[] | null;
    };

    const callRows = (callsDetailRes.data ?? []) as CallDetailRow[];

    callOutcomes = buildHomeCallOutcomeSegments(
      callRows.map((row) => row.outcome),
    );
    minutesInRange = sumBillableMinutesFromDurations(
      callRows.map((row) => row.duration_seconds),
    );

    const callsByOrg = new Map<string, { name: string; calls: number }>();
    for (const row of callRows) {
      const orgId = row.organization_id;
      const name = embeddedOrgName(row.organizations);
      const existing = callsByOrg.get(orgId);
      if (existing) {
        existing.calls += 1;
      } else {
        callsByOrg.set(orgId, { name, calls: 1 });
      }
    }

    topTenants = [...callsByOrg.entries()]
      .map(([orgId, value]) => ({ orgId, name: value.name, calls: value.calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 5);

    recentCalls = callRows.slice(0, 8).map((row) => {
      const outcome = normalizeCallOutcome(String(row.outcome ?? ""));
      const caller =
        row.caller_name?.trim() ||
        row.caller_number?.trim() ||
        "Unknown caller";
      return {
        id: row.id,
        orgName: embeddedOrgName(row.organizations),
        caller,
        outcomeLabel: OUTCOME_LABELS[outcome] ?? "Other",
        timeLabel: formatDashboardFeedRelativeTime(row.created_at),
      };
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load admin data.";
  }

  return (
    <div
      data-admin-fill
      className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-6 lg:flex-row lg:gap-5"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        {loadError ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-medium text-red-800">{loadError}</p>
          </div>
        ) : null}

        <AdminGlobalMetricsBoard
          periodLabel={periodShort}
          periodRangeLabel={periodRangeLabel}
          calls={callsInRange}
          pipelineIncidents={pipelineIncidents7d}
          authFailures={authFailures24h}
          support={openSupportTickets}
          organizations={orgCount}
          minutesUsed={formatMinutes(minutesInRange)}
          callOutcomes={callOutcomes}
          topTenants={topTenants}
          recentCalls={recentCalls}
        />
      </div>

      <div className="flex min-h-0 w-full shrink-0 flex-col lg:h-full lg:min-h-0 lg:w-[300px]">
        <AdminTenantsPanel organizations={organizations} />
      </div>
    </div>
  );
}
