import {
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
  parseDashboardMetricRange,
} from "@/lib/dashboard-metric-range";
import { buildDashboardActivityFeed } from "@/lib/dashboard-activity-feed";
import { ACTIVITY_FEED_LIMIT } from "@/lib/dashboard-list-limits";
import { formatDashboardFeedRelativeTime } from "@/lib/dashboard-feed-time";
import { ALL_LOCATIONS_VIEW_COOKIE } from "@/lib/account-locations";
import { resolveDashboardOrganizationScope } from "@/lib/dashboard-scope";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { cookies } from "next/headers";

import { ActivityView } from "./activity-view";

export const dynamic = "force-dynamic";

type ActivityPageProps = {
  searchParams?: Promise<{ range?: string }>;
};

function applyRangeEnd<T extends { gte: (col: string, v: string) => T; lt: (col: string, v: string) => T }>(
  query: T,
  rangeEndExclusiveIso: string | null,
): T {
  if (rangeEndExclusiveIso) {
    return query.lt("created_at", rangeEndExclusiveIso);
  }
  return query;
}

function applyOrganizationScope<T>(query: T, organizationIds: string[]): T {
  const scoped = query as {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
  };
  if (organizationIds.length === 1) {
    return scoped.eq("organization_id", organizationIds[0]!);
  }
  return scoped.in("organization_id", organizationIds);
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const session = await requireDashboardSession();
  const { supabase } = session;
  const cookieStore = await cookies();
  const viewAllLocations =
    cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";
  const scope = await resolveDashboardOrganizationScope(
    session,
    viewAllLocations,
  );
  const scopedOrgIds = scope.organizationIds;

  const sp = searchParams ? await searchParams : {};
  const metricRangeStartIso = getDashboardMetricRangeLowerBoundIso(
    parseDashboardMetricRange(sp.range),
  );
  const metricRangeEndExclusiveIso =
    getDashboardMetricRangeUpperExclusiveIso(
      parseDashboardMetricRange(sp.range),
    );

  const callsQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("call_logs")
        .select(
          "id, created_at, outcome, caller_number, caller_name, ai_summary",
        )
        .gte("created_at", metricRangeStartIso)
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_FEED_LIMIT),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const ticketsQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("action_tickets")
        .select("id, created_at, caller_name, caller_number")
        .gte("created_at", metricRangeStartIso)
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_FEED_LIMIT),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const [callsRes, ticketsRes] = await Promise.all([
    callsQuery,
    ticketsQuery,
  ]);

  const calls = callsRes.error ? [] : (callsRes.data ?? []);
  const tickets = ticketsRes.error ? [] : (ticketsRes.data ?? []);

  const rows = buildDashboardActivityFeed({
    calls,
    tickets,
    formatTime: formatDashboardFeedRelativeTime,
    limit: ACTIVITY_FEED_LIMIT,
  });

  const linksSent = calls.filter((c) => c.outcome === "link_sent").length;
  const callbacks = calls.filter((c) => c.outcome === "callback_requested").length;
  const summary = [
    { value: String(calls.length), label: calls.length === 1 ? "call" : "calls" },
    { value: String(linksSent), label: "links sent" },
    { value: String(callbacks), label: "callbacks" },
    {
      value: String(tickets.length),
      label: tickets.length === 1 ? "request" : "requests",
    },
  ];

  return <ActivityView rows={rows} summary={summary} />;
}
