import {
  dashboardMetricRangeGreetingSubline,
  dashboardMetricRangePeriodPhrase,
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
  parseDashboardMetricRange,
  type DashboardMetricRangeKey,
} from "@/lib/dashboard-metric-range";
import { buildCaraLastCallSnapshot } from "@/lib/cara-last-call";
import { buildCaraStatus } from "@/lib/cara-status";
import { normalizeCallOutcome } from "@/lib/call-history-types";
import {
  DASHBOARD_HOME_ATTENTION_ROW_LIMIT,
  DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
} from "@/lib/dashboard-home-panel-limit";
import { DashboardHomeEnter } from "@/components/dashboard/dashboard-home-enter";
import { DashboardHomeHeader } from "@/components/dashboard/dashboard-home-header";
import { DashboardHomeWorkspace } from "@/components/dashboard/dashboard-home-workspace";
import { DashboardStatStrip } from "@/components/dashboard/dashboard-stat-strip";
import {
  DASHBOARD_HOME_CARD,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  formatDashboardFeedTime,
  ticketCallerLabel,
} from "@/lib/dashboard-feed-time";
import { sumBillableMinutesFromDurations } from "@/lib/billable-minutes";
import { buildHomeAttentionItems } from "@/lib/dashboard-home-attention";
import { isRoutedCallOutcome } from "@/lib/dashboard-routed-outcomes";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { cn } from "@/lib/utils";

type DashboardHomePageProps = {
  searchParams?: Promise<{ range?: string }>;
};

type CallLogRow = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
  duration_seconds: number | null;
};

type TicketRow = {
  id: string;
  summary: string | null;
  created_at: string;
  caller_name?: string | null;
  caller_number?: string | null;
};

/** Per-source cap when merging calls + tickets into recent activity. */
const DASHBOARD_HOME_ACTIVITY_SOURCE_FETCH_LIMIT =
  DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT;

function countExact(res: {
  count: number | null;
  error: { message: string } | null;
}): number {
  if (res.error) return 0;
  return res.count ?? 0;
}

function callEventTitle(outcome: string | null): string {
  switch (normalizeCallOutcome(String(outcome ?? ""))) {
    case "link_sent":
      return "Routed";
    case "callback_requested":
      return "Callback requested";
    case "action_created":
      return "Request captured";
    case "voicemail_or_no_speech":
      return "Voicemail";
    case "failed":
      return "Missed call";
    case "spam_or_abuse":
      return "Spam call";
    case "answered":
    default:
      return "Call answered";
  }
}

function callerLabelFor(row: CallLogRow): string {
  const name = row.caller_name?.trim();
  if (name) return name;
  const phone = row.caller_number?.trim();
  if (phone) return phone;
  return "Unknown caller";
}

function getFirstName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function applyRangeEnd<T extends { gte: (col: string, v: string) => T; lt: (col: string, v: string) => T }>(
  query: T,
  rangeEndExclusiveIso: string | null,
): T {
  if (rangeEndExclusiveIso) {
    return query.lt("created_at", rangeEndExclusiveIso);
  }
  return query;
}

export default async function DashboardHomePage({
  searchParams,
}: DashboardHomePageProps) {
  const { supabase, organizationId, profile } =
    await requireDashboardSession();

  const sp = searchParams ? await searchParams : {};
  const metricRange: DashboardMetricRangeKey = parseDashboardMetricRange(sp.range);
  const panelPeriodPhrase = dashboardMetricRangePeriodPhrase(metricRange);
  const greetingSubline = dashboardMetricRangeGreetingSubline(metricRange);

  const metricRangeStartIso = getDashboardMetricRangeLowerBoundIso(metricRange);
  const metricRangeEndExclusiveIso =
    getDashboardMetricRangeUpperExclusiveIso(metricRange);

  const callsInMetricRangeQuery = applyRangeEnd(
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", metricRangeStartIso),
    metricRangeEndExclusiveIso,
  );

  const actionsInMetricRangeQuery = applyRangeEnd(
    supabase
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", metricRangeStartIso),
    metricRangeEndExclusiveIso,
  );

  const callsForMetricRollupsQuery = applyRangeEnd(
    supabase
      .from("call_logs")
      .select("outcome, duration_seconds")
      .eq("organization_id", organizationId)
      .gte("created_at", metricRangeStartIso),
    metricRangeEndExclusiveIso,
  );

  /** Calls in the selected metric range (activity, attention, outcome charts). */
  const callsForPanelsQuery = applyRangeEnd(
    supabase
      .from("call_logs")
      .select(
        "id, created_at, outcome, caller_number, caller_name, duration_seconds",
      )
      .eq("organization_id", organizationId)
      .gte("created_at", metricRangeStartIso)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_HOME_ACTIVITY_SOURCE_FETCH_LIMIT * 2),
    metricRangeEndExclusiveIso,
  );

  const recentTicketsForPanelsQuery = applyRangeEnd(
    supabase
      .from("action_tickets")
      .select("id, summary, created_at, caller_name, caller_number")
      .eq("organization_id", organizationId)
      .gte("created_at", metricRangeStartIso)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_HOME_ACTIVITY_SOURCE_FETCH_LIMIT),
    metricRangeEndExclusiveIso,
  );

  const [
    callsInMetricRangeRes,
    actionsInMetricRangeRes,
    openActionsRes,
    callsForMetricRollupsRes,
    callsForPanelsRes,
    recentTicketsForPanelsRes,
    openTicketsRes,
    orgRes,
    latestCallRes,
  ] = await Promise.all([
    callsInMetricRangeQuery,
    actionsInMetricRangeQuery,
    supabase
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open"),
    callsForMetricRollupsQuery,
    callsForPanelsQuery,
    recentTicketsForPanelsQuery,
    supabase
      .from("action_tickets")
      .select("id, summary, created_at, caller_name, caller_number")
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_HOME_ATTENTION_ROW_LIMIT),
    supabase
      .from("organizations")
      .select("is_active, status, phone_number")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("call_logs")
      .select("id, created_at, caller_number, caller_name, outcome")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const callsForPanels = (
    callsForPanelsRes.error ? [] : (callsForPanelsRes.data ?? [])
  ) as CallLogRow[];

  const callsForMetricRollups = callsForMetricRollupsRes.error
    ? []
    : (callsForMetricRollupsRes.data ?? []);

  const callsAnswered = countExact(callsInMetricRangeRes);
  const actionsCreated = countExact(actionsInMetricRangeRes);
  const openActions = countExact(openActionsRes);

  const routedCount = callsForMetricRollups.filter((row) =>
    isRoutedCallOutcome(row.outcome),
  ).length;
  const minutesUsed = sumBillableMinutesFromDurations(
    callsForMetricRollups.map((row) => row.duration_seconds),
  );

  const org = orgRes.error ? null : orgRes.data;
  const callOutcomes = callsForPanels.map((row) => row.outcome);
  const callDurationSeconds = callsForPanels.map((row) => row.duration_seconds);

  const lastCall = buildCaraLastCallSnapshot(
    latestCallRes.error || !latestCallRes.data
      ? null
      : (latestCallRes.data as CallLogRow),
  );

  const caraStatus = buildCaraStatus({
    lifecycleStatus: (org?.status as string | undefined) ?? "active",
    isActive: org?.is_active !== false,
    phoneNumber: (org?.phone_number as string | null)?.trim() || null,
    openFollowUpCount: openActions,
    periodPhrase: panelPeriodPhrase,
    lastCall,
  });

  const ticketRows = (recentTicketsForPanelsRes.error
    ? []
    : (recentTicketsForPanelsRes.data ?? [])) as TicketRow[];

  const openTicketRows = (openTicketsRes.error
    ? []
    : (openTicketsRes.data ?? [])) as TicketRow[];

  const attentionItems = buildHomeAttentionItems({
    openTickets: openTicketRows,
    calls: callsForPanels,
    callerLabel: (row) =>
      callerLabelFor({ ...row, duration_seconds: null }),
    callOutcomeLabel: callEventTitle,
    formatTime: formatDashboardFeedTime,
  });

  const recentCallsForFeed = callsForPanels.slice(
    0,
    DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
  );

  const activity = [
    ...recentCallsForFeed.map((row) => ({
      id: `${row.id}-call`,
      title: callerLabelFor(row),
      time: formatDashboardFeedTime(row.created_at),
      href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
      badge: callEventTitle(row.outcome),
      timestamp: new Date(row.created_at).getTime(),
    })),
    ...ticketRows.map((row) => ({
      id: `${row.id}-ticket`,
      title: ticketCallerLabel(row),
      subtitle:
        row.summary?.replace(/\s+/g, " ").trim() || "Request captured",
      time: formatDashboardFeedTime(row.created_at),
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(row.id)}`,
      badge: "Request",
      timestamp: new Date(row.created_at).getTime(),
    })),
  ]
    .filter((row) => Number.isFinite(row.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT)
    .map((row) => ({
      id: row.id,
      title: row.title,
      time: row.time,
      href: row.href,
      badge: row.badge,
    }));

  const firstName = getFirstName(profile?.name);
  const greeting = firstName ? `Hello, ${firstName}` : "Hello";

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <DashboardHomeEnter>
        <DashboardHomeHeader
          greeting={greeting}
          greetingSubline={greetingSubline}
          openActions={openActions}
          caraActive={org?.is_active !== false}
        />

        <section className={cn(DASHBOARD_HOME_CARD, "shrink-0")}>
          <DashboardStatStrip
            compact
            stats={[
              {
                label: "Calls answered",
                value: String(callsAnswered),
                href: DASHBOARD_ROUTES.calls,
              },
              {
                label: "Requests captured",
                value: String(actionsCreated),
                href: DASHBOARD_ROUTES.actionInbox,
              },
              {
                label: "Routed",
                value: String(routedCount),
                href: DASHBOARD_ROUTES.routing,
              },
              {
                label: "Needs attention",
                value: String(openActions),
                href: DASHBOARD_ROUTES.actionInbox,
              },
              {
                label: "Minutes used",
                value: String(minutesUsed),
                href: DASHBOARD_ROUTES.usage,
              },
            ]}
          />
        </section>

        <DashboardHomeWorkspace
          periodPhrase={panelPeriodPhrase}
          caraStatus={caraStatus}
          callOutcomes={callOutcomes}
          callDurationSeconds={callDurationSeconds}
          activity={activity}
          attentionItems={attentionItems}
          openActions={openActions}
        />
      </DashboardHomeEnter>
    </div>
  );
}
