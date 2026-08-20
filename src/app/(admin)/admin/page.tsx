import Link from "next/link";
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
import { NewClientDialog } from "./new-client-dialog";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
  let openTickets = 0;
  let urgentEngineeringOpen = 0;
  let openSupportTickets = 0;
  let ticketsCreatedInRange = 0;
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
  }[] = [];
  type UrgentEngineeringRow = {
    id: string;
    caller_number: string;
    summary: string;
    created_at: string;
    organization_id: string;
    organizations: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };
  let urgentEngineeringTickets: UrgentEngineeringRow[] = [];
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();

    const [
      orgsRes,
      callsRes,
      ticketsRes,
      ticketsCreatedRes,
      urgentCountRes,
      urgentListRes,
      supportRes,
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
        .from("action_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin
        .from("action_tickets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndExclusiveIso),
      admin
        .from("action_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("engineering_priority", "urgent"),
      admin
        .from("action_tickets")
        .select(
          "id, caller_number, summary, created_at, organization_id, organizations ( name, slug )",
        )
        .eq("status", "open")
        .eq("engineering_priority", "urgent")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
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
    if (ticketsRes.error) throw new Error(ticketsRes.error.message);
    if (ticketsCreatedRes.error) throw new Error(ticketsCreatedRes.error.message);
    if (urgentCountRes.error) throw new Error(urgentCountRes.error.message);
    if (urgentListRes.error) throw new Error(urgentListRes.error.message);
    if (listRes.error) throw new Error(listRes.error.message);
    if (callsDetailRes.error) throw new Error(callsDetailRes.error.message);

    orgCount = orgsRes.count ?? 0;
    callsInRange = callsRes.count ?? 0;
    openTickets = ticketsRes.count ?? 0;
    ticketsCreatedInRange = ticketsCreatedRes.count ?? 0;
    urgentEngineeringOpen = urgentCountRes.count ?? 0;
    urgentEngineeringTickets = (urgentListRes.data ?? []) as UrgentEngineeringRow[];
    openSupportTickets = supportRes.error ? 0 : (supportRes.count ?? 0);
    organizations = listRes.data ?? [];

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
    <div className="flex min-h-full flex-col gap-4 p-4 lg:h-full lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-5 lg:overflow-hidden lg:p-5">
      <div className="flex min-h-[480px] min-w-0 flex-1 flex-col gap-4 overflow-hidden lg:min-h-0">
        {process.env.ADMIN_ALLOW_MANUAL_CREATE === "1" ? (
          <div className="flex justify-end">
            <NewClientDialog />
          </div>
        ) : null}

        {loadError ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-medium text-red-800">{loadError}</p>
          </div>
        ) : null}

        {!loadError && urgentEngineeringTickets.length > 0 ? (
          <section aria-labelledby="eng-call-queue-heading">
            <h2 id="eng-call-queue-heading" className="sr-only">
              Engineering queue
            </h2>
            <ul className="space-y-2">
              {urgentEngineeringTickets.slice(0, 3).map((t) => {
                const orgName = embeddedOrgName(t.organizations);
                return (
                  <li
                    key={t.id}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
                  >
                    <span className="font-semibold">{orgName}</span>
                    {" · "}
                    {t.summary}
                    {" · "}
                    <Link
                      href={`/admin/organizations/${t.organization_id}`}
                      className="font-medium underline"
                    >
                      Manage
                    </Link>
                    <span className="ml-2 text-xs text-red-800/60">
                      {formatDate(t.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <AdminGlobalMetricsBoard
          periodLabel={periodShort}
          periodRangeLabel={periodRangeLabel}
          calls={callsInRange}
          openInbox={openTickets}
          urgent={urgentEngineeringOpen}
          support={openSupportTickets}
          organizations={orgCount}
          ticketsCreated={ticketsCreatedInRange}
          minutesUsed={formatMinutes(minutesInRange)}
          callOutcomes={callOutcomes}
          topTenants={topTenants}
          recentCalls={recentCalls}
        />
      </div>

      <div className="flex min-h-[240px] shrink-0 flex-col lg:h-full lg:min-h-0 lg:w-[300px]">
        <AdminTenantsPanel organizations={organizations} />
      </div>
    </div>
  );
}
