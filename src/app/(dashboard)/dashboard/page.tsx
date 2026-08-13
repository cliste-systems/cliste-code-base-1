import {
  dashboardMetricRangePeriodPhrase,
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
  parseDashboardMetricRange,
  type DashboardMetricRangeKey,
} from "@/lib/dashboard-metric-range";
import { DashboardHomeCardsGrid } from "@/components/dashboard/dashboard-home-cards-grid";
import { DashboardHomeEnter } from "@/components/dashboard/dashboard-home-enter";
import { DashboardHomeHero } from "@/components/dashboard/dashboard-home-hero";
import { DASHBOARD_PAGE_SHELL_FILL_WHITE, DASHBOARD_HOME_CONTENT_COLUMN } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { buildDashboardActivityFeed } from "@/lib/dashboard-activity-feed";
import { isRoutedCallOutcome } from "@/lib/dashboard-routed-outcomes";
import {
  formatDashboardFeedRelativeTime,
} from "@/lib/dashboard-feed-time";
import { formatMinutes } from "@/app/(dashboard)/dashboard/billing/usage-helpers";
import { loadAccountBilling } from "@/lib/account-session";
import { PLANS } from "@/lib/cliste-plans";
import {
  buildHomeCallOutcomeSegments,
  buildHomeRequestTypeSegments,
  buildHomeUsageSnapshot,
} from "@/lib/dashboard-home-analytics";
import { buildHomeCaraPerformance } from "@/lib/dashboard-home-cara-performance";
import { buildCaraLastCallSnapshot } from "@/lib/cara-last-call";
import { buildCaraStatus } from "@/lib/cara-status";
import {
  buildHomeCaraTrainingRows,
  buildHomeTodaysRequestRows,
  type HomeCaraTrainingItemRow,
  type HomeRequestTicketRow,
} from "@/lib/dashboard-home-requests";
import {
  DASHBOARD_HOME_ATTENTION_ROW_LIMIT,
  DASHBOARD_HOME_CARA_TRAINING_ROW_LIMIT,
  DASHBOARD_HOME_INBOX_DISPLAY_LIMIT,
  DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
} from "@/lib/dashboard-home-panel-limit";
import { buildHomeCallTimesBuckets } from "@/lib/dashboard-home-call-times";
import { DASHBOARD_HOME_MOCK } from "@/lib/dashboard-home-mock-data";
import { isDashboardHomeMockEnabled } from "@/lib/dashboard-home-mock";
import { dashboardTimeGreeting } from "@/lib/dashboard-greeting";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { ALL_LOCATIONS_VIEW_COOKIE } from "@/lib/account-locations";
import { resolveDashboardOrganizationScope } from "@/lib/dashboard-scope";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { sumBillableMinutesFromDurations } from "@/lib/billable-minutes";
import { cookies } from "next/headers";

type DashboardHomePageProps = {
  searchParams?: Promise<{ range?: string; welcome?: string }>;
};

type CallLogRow = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
  duration_seconds: number | null;
  ai_summary?: string | null;
};

type TicketRow = {
  id: string;
  summary: string | null;
  created_at: string;
  status: string | null;
  caller_name?: string | null;
  caller_number?: string | null;
};

const DASHBOARD_HOME_ACTIVITY_SOURCE_FETCH_LIMIT =
  DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT;

function countExact(res: {
  count: number | null;
  error: { message: string } | null;
}): number {
  if (res.error) return 0;
  return res.count ?? 0;
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

function defaultPeriodStart(): string {
  return new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export default async function DashboardHomePage({
  searchParams,
}: DashboardHomePageProps) {
  const session = await requireDashboardSession();
  const { supabase, organizationId, profile, accountId } = session;
  const cookieStore = await cookies();
  const viewAllLocations =
    cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";
  const scope = await resolveDashboardOrganizationScope(
    session,
    viewAllLocations,
  );
  const scopedOrgIds = scope.organizationIds;

  const sp = searchParams ? await searchParams : {};
  const metricRange: DashboardMetricRangeKey = parseDashboardMetricRange(sp.range);
  const panelPeriodPhrase = dashboardMetricRangePeriodPhrase(metricRange);

  const metricRangeStartIso = getDashboardMetricRangeLowerBoundIso(metricRange);
  const metricRangeEndExclusiveIso =
    getDashboardMetricRangeUpperExclusiveIso(metricRange);

  const accountBilling = await loadAccountBilling(accountId);
  const planTier = accountBilling?.planTier ?? "pro";
  const plan = PLANS[planTier];
  const billingPeriodStart =
    accountBilling?.billingPeriodStart ?? defaultPeriodStart();

  const callsInMetricRangeQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const actionsInMetricRangeQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("action_tickets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const callsForMetricRollupsQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("call_logs")
        .select("outcome, duration_seconds, ai_summary")
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const callsForPanelsQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("call_logs")
        .select(
          "id, created_at, outcome, caller_number, caller_name, duration_seconds, ai_summary",
        )
        .gte("created_at", metricRangeStartIso)
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_HOME_ACTIVITY_SOURCE_FETCH_LIMIT * 2),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const recentTicketsForPanelsQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("action_tickets")
        .select("id, summary, created_at, caller_name, caller_number")
        .gte("created_at", metricRangeStartIso)
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_HOME_ACTIVITY_SOURCE_FETCH_LIMIT),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const ticketsForRequestTypesQuery = applyRangeEnd(
    applyOrganizationScope(
      supabase
        .from("action_tickets")
        .select("summary")
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ),
    metricRangeEndExclusiveIso,
  );

  const usageRecordsQuery = applyOrganizationScope(
    supabase
      .from("usage_records")
      .select("minutes_billable")
      .gte("billing_period_start", billingPeriodStart),
    scopedOrgIds.length > 0 ? scopedOrgIds : [organizationId],
  );

  const trainingItemsQuery = applyOrganizationScope(
    supabase
      .from("cara_training_items")
      .select("id, gap_summary, status, updated_at")
      .neq("status", "dismissed")
      .order("updated_at", { ascending: false })
      .limit(DASHBOARD_HOME_CARA_TRAINING_ROW_LIMIT),
    scopedOrgIds,
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
    ticketsForRequestTypesRes,
    usageRecordsRes,
    trainingItemsRes,
    openTrainingCountRes,
  ] = await Promise.all([
    callsInMetricRangeQuery,
    actionsInMetricRangeQuery,
    applyOrganizationScope(
      supabase
        .from("action_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .gte("created_at", metricRangeStartIso),
      scopedOrgIds,
    ),
    callsForMetricRollupsQuery,
    callsForPanelsQuery,
    recentTicketsForPanelsQuery,
    applyOrganizationScope(
      supabase
        .from("action_tickets")
        .select("id, summary, created_at, status, caller_name, caller_number")
        .eq("status", "open")
        .gte("created_at", metricRangeStartIso)
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_HOME_ATTENTION_ROW_LIMIT),
      scopedOrgIds,
    ),
    supabase
      .from("organizations")
      .select(
        "is_active, status, phone_number, onboarding_step, business_hours, agent_opening_hours, routing_links, agent_business_rules, agent_faqs, agent_services_departments, niche, cara_handle_options",
      )
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("call_logs")
      .select("id, created_at, caller_number, caller_name, outcome")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ticketsForRequestTypesQuery,
    usageRecordsQuery,
    trainingItemsQuery,
    applyOrganizationScope(
      supabase
        .from("cara_training_items")
        .select("id", { count: "exact", head: true })
        .neq("status", "dismissed"),
      scopedOrgIds,
    ),
  ]);

  const callsForPanels = (
    callsForPanelsRes.error ? [] : (callsForPanelsRes.data ?? [])
  ) as CallLogRow[];

  const callsForMetricRollups = callsForMetricRollupsRes.error
    ? []
    : (callsForMetricRollupsRes.data ?? []);

  const callsAnsweredLive = countExact(callsInMetricRangeRes);
  const actionsCreatedLive = countExact(actionsInMetricRangeRes);
  const openActionsLive = countExact(openActionsRes);

  const routedCountLive = callsForMetricRollups.filter((row) =>
    isRoutedCallOutcome(row.outcome),
  ).length;
  const minutesUsedLive = sumBillableMinutesFromDurations(
    callsForMetricRollups.map((row) => row.duration_seconds),
  );

  let billingMinutesUsed = 0;
  for (const row of usageRecordsRes.error ? [] : (usageRecordsRes.data ?? [])) {
    const value = (row as { minutes_billable: number | null }).minutes_billable;
    billingMinutesUsed +=
      typeof value === "number" ? value : Number(value) || 0;
  }

  const org = orgRes.error ? null : orgRes.data;

  const lastCall = buildCaraLastCallSnapshot(
    latestCallRes.error || !latestCallRes.data
      ? null
      : (latestCallRes.data as CallLogRow),
  );

  const caraStatus = buildCaraStatus({
    lifecycleStatus: (org?.status as string | undefined) ?? "active",
    isActive: org?.is_active !== false,
    phoneNumber: (org?.phone_number as string | null)?.trim() || null,
    openFollowUpCount: openActionsLive,
    periodPhrase: panelPeriodPhrase,
    lastCall,
  });

  const ticketRows = (recentTicketsForPanelsRes.error
    ? []
    : (recentTicketsForPanelsRes.data ?? [])) as TicketRow[];

  const openTicketRows = (openTicketsRes.error
    ? []
    : (openTicketsRes.data ?? [])) as HomeRequestTicketRow[];

  const needsAttentionLive = buildHomeTodaysRequestRows({
    tickets: openTicketRows,
    formatTime: formatDashboardFeedRelativeTime,
    limit: DASHBOARD_HOME_ATTENTION_ROW_LIMIT,
  });

  const trainingItemRows = (trainingItemsRes.error
    ? []
    : (trainingItemsRes.data ?? [])) as HomeCaraTrainingItemRow[];

  const caraTrainingLive = buildHomeCaraTrainingRows({
    items: trainingItemRows,
    formatTime: formatDashboardFeedRelativeTime,
    limit: DASHBOARD_HOME_CARA_TRAINING_ROW_LIMIT,
  });

  const openTrainingCountLive = countExact(openTrainingCountRes);

  const recentCallsForFeed = callsForPanels.slice(
    0,
    DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
  );

  const activityLive = buildDashboardActivityFeed({
    calls: recentCallsForFeed,
    tickets: ticketRows,
    formatTime: formatDashboardFeedRelativeTime,
    limit: DASHBOARD_HOME_RECENT_ACTIVITY_LIMIT,
  });

  const ticketSummaries = (ticketsForRequestTypesRes.error
    ? []
    : (ticketsForRequestTypesRes.data ?? [])) as { summary: string | null }[];

  const requestTypeSegmentsLive = buildHomeRequestTypeSegments(
    ticketSummaries.map((row) => row.summary),
  );
  const callOutcomeSegmentsLive = buildHomeCallOutcomeSegments(
    callsForMetricRollups.map((row) => row.outcome),
  );
  const usageSnapshotLive = buildHomeUsageSnapshot({
    minutesUsed: billingMinutesUsed > 0 ? billingMinutesUsed : minutesUsedLive,
    includedMinutes: plan.includedMinutes,
  });
  const caraPerformanceLive = buildHomeCaraPerformance({
    isOnline: caraStatus.isOnline,
    statusLabel: caraStatus.isOnline ? "Live" : "Offline",
    calls: callsForMetricRollups.map((row) => ({
      outcome: String(row.outcome ?? ""),
      duration_seconds:
        typeof row.duration_seconds === "number" ? row.duration_seconds : null,
      ai_summary: (row as { ai_summary?: string | null }).ai_summary ?? null,
    })),
  });

  const todayStartIso = getDashboardMetricRangeLowerBoundIso("today");
  const callTimesLive = buildHomeCallTimesBuckets(
    callsForPanels
      .filter((row) => row.created_at >= todayStartIso)
      .map((row) => row.created_at),
  );

  const useHomeMock = isDashboardHomeMockEnabled();

  const activity = useHomeMock ? [...DASHBOARD_HOME_MOCK.activity] : activityLive;
  const needsAttention = useHomeMock
    ? [...DASHBOARD_HOME_MOCK.needsAttention]
    : needsAttentionLive;
  const openActions = useHomeMock ? DASHBOARD_HOME_MOCK.openActions : openActionsLive;
  const caraTraining = useHomeMock
    ? [...DASHBOARD_HOME_MOCK.caraTraining]
    : caraTrainingLive;
  const openTrainingCount = useHomeMock
    ? DASHBOARD_HOME_MOCK.openTrainingCount
    : openTrainingCountLive;
  const requestTypeSegments = useHomeMock
    ? [...DASHBOARD_HOME_MOCK.requestTypeSegments]
    : requestTypeSegmentsLive;
  const callOutcomeSegments = useHomeMock
    ? [...DASHBOARD_HOME_MOCK.callOutcomeSegments]
    : callOutcomeSegmentsLive;
  const callTimes = useHomeMock ? [...DASHBOARD_HOME_MOCK.callTimes] : callTimesLive;
  const caraPerformance = useHomeMock
    ? DASHBOARD_HOME_MOCK.caraPerformance
    : caraPerformanceLive;
  const callsAnswered = useHomeMock
    ? DASHBOARD_HOME_MOCK.hero.callsAnswered
    : callsAnsweredLive;
  const actionsCreated = useHomeMock
    ? DASHBOARD_HOME_MOCK.hero.requestsCaptured
    : actionsCreatedLive;
  const routedCount = useHomeMock ? DASHBOARD_HOME_MOCK.hero.routed : routedCountLive;
  const openActionsDisplay = openActions;
  const minutesUsedDisplay = useHomeMock
    ? DASHBOARD_HOME_MOCK.hero.minutesUsed
    : usageSnapshotLive.minutesUsed;

  const firstName = getFirstName(profile?.name);
  const greeting = dashboardTimeGreeting(firstName);
  const orgRow = await getCachedDashboardOrganizationRow();
  const homeCopy = dashboardVerticalCopy(
    orgRow?.niche,
    orgRow?.agent_business_type,
  );

  return (
    <div
      className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "min-h-0")}
      data-dashboard-fill
      data-dashboard-home
    >
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardHomeEnter className="min-h-0 flex-1 lg:h-full">
          <DashboardHomeHero
            className="shrink-0 lg:h-[220px] lg:max-h-[220px] lg:min-h-[200px]"
            greeting={greeting}
            subheading={homeCopy.home.heroSubheading}
            stats={[
              {
                label: "Calls answered",
                value: String(callsAnswered),
                href: DASHBOARD_ROUTES.calls,
              },
              {
                label: "Enquiries captured",
                value: String(actionsCreated),
                href: DASHBOARD_ROUTES.actionInbox,
              },
              {
                label: "Info sent",
                value: String(routedCount),
                href: DASHBOARD_ROUTES.routing,
              },
              {
                label: "Needs attention",
                value: String(openActionsDisplay),
                href: DASHBOARD_ROUTES.actionInbox,
              },
              {
                label: "Minutes this period",
                value: formatMinutes(minutesUsedDisplay),
                href: DASHBOARD_ROUTES.usage,
              },
            ]}
          />

          <DashboardHomeCardsGrid
            className="min-h-0 flex-1"
            activity={activity}
            needsAttention={needsAttention}
            openActions={openActionsDisplay}
            caraTraining={caraTraining}
            openTrainingCount={openTrainingCount}
            caraPerformance={caraPerformance}
            requestTypeSegments={requestTypeSegments}
            callOutcomeSegments={callOutcomeSegments}
            callTimes={callTimes}
          />
        </DashboardHomeEnter>
      </div>
    </div>
  );
}
