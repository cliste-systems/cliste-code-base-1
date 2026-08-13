import { Phone } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import {
  OUTCOME_LABELS,
  inferCallIntent,
  mapCallLogToRow,
  normalizeCallOutcome,
} from "@/lib/call-history-types";
import {
  CALL_HISTORY_OPEN_TICKET_LIMIT,
  CALL_HISTORY_PAGE_SIZE,
} from "@/lib/dashboard-list-limits";
import {
  dashboardMetricRangeGreetingSubline,
  getDashboardMetricRangeLowerBoundIso,
  getDashboardMetricRangeUpperExclusiveIso,
  parseDashboardMetricRange,
} from "@/lib/dashboard-metric-range";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { normalizeBlockedCallerE164 } from "@/lib/blocked-callers";

import { assignOpenTicketsToCalls } from "@/lib/call-history-follow-up";

import { DashboardHeaderRangeControls } from "../dashboard-header-range-controls";
import {
  buildCallHistoryMetricsFromSummaryRows,
  type CallFollowUp,
  type CallHistoryListItem,
  callSummaryForDisplay,
} from "./call-history-helpers";
import { CallHistoryView } from "./call-history-view";

type CallHistoryPageProps = {
  searchParams?: Promise<{ call?: string; range?: string; page?: string }>;
};

type CallLogListRow = {
  id: string;
  caller_number: string;
  caller_name?: string | null;
  duration_seconds: number;
  outcome: string;
  ai_summary: string | null;
  created_at: string;
};

type CallLogMetricsRow = {
  outcome: string;
  duration_seconds: number;
};

type TicketDbRow = {
  id: string;
  caller_number: string;
  caller_name?: string | null;
  summary: string;
  status: string;
  created_at: string;
};

type CallLinkRow = {
  id: string;
  caller_number: string;
  created_at: string;
};

function parsePageParam(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function toListItem(
  row: CallLogListRow,
  followUpByCallId: Map<string, CallFollowUp>,
  businessName: string,
  blockedSet: Set<string>,
): CallHistoryListItem {
  const mapped = mapCallLogToRow({
    ...row,
    transcript: null,
    transcript_review: null,
  });
  const followUp = followUpByCallId.get(row.id) ?? null;
  const outcome = normalizeCallOutcome(row.outcome);
  const item: CallHistoryListItem = {
    id: mapped.id,
    createdAt: row.created_at,
    dateTimeLabel: mapped.dateTimeLabel,
    callerId: mapped.callerId,
    callerDisplay: mapped.callerDisplay || "Unknown number",
    callerName: row.caller_name?.trim() || null,
    durationSeconds: Math.max(0, row.duration_seconds ?? 0),
    durationLabel: mapped.durationLabel || "—",
    outcome,
    outcomeLabel: OUTCOME_LABELS[outcome],
    intentLabel: mapped.intentLabel || inferCallIntent(mapped.aiSummary, outcome),
    summaryPreview: null,
    transcriptVerbatim: "",
    transcriptReview: null,
    aiSummary: mapped.aiSummary,
    hasOpenAction: Boolean(followUp),
    followUp,
  };
  item.summaryPreview = callSummaryForDisplay(item, {
    businessName,
    callerIsBlocked:
      normalizeBlockedCallerE164(mapped.callerId) != null &&
      blockedSet.has(normalizeBlockedCallerE164(mapped.callerId)!),
  });
  return item;
}

export default async function CallHistoryPage({ searchParams }: CallHistoryPageProps) {
  const sp = searchParams ? await searchParams : {};
  const rangeKey = parseDashboardMetricRange(sp.range);
  const greetingSubline = dashboardMetricRangeGreetingSubline(rangeKey);
  const initialSelectedCallId =
    typeof sp.call === "string" && sp.call.trim() ? sp.call.trim() : null;
  const requestedPage = parsePageParam(sp.page);

  const { supabase, organizationId } = await requireDashboardSession();
  const orgRow = await getCachedDashboardOrganizationRow();
  const businessName = String(orgRow?.name ?? "").trim();

  const lowerIso = getDashboardMetricRangeLowerBoundIso(rangeKey);
  const upperIso = getDashboardMetricRangeUpperExclusiveIso(rangeKey);

  function applyRangeFilters<T extends { gte: (col: string, val: string) => T }>(
    query: T,
  ): T {
    let q = query.gte("created_at", lowerIso);
    if (upperIso) {
      q = (q as T & { lt: (col: string, val: string) => T }).lt(
        "created_at",
        upperIso,
      );
    }
    return q;
  }

  const listFrom = (requestedPage - 1) * CALL_HISTORY_PAGE_SIZE;
  const listTo = listFrom + CALL_HISTORY_PAGE_SIZE - 1;

  const [
    { count: totalCount, error: countError },
    { data: metricsData, error: metricsError },
    { data: pageData, error: listError },
    { data: linkRows },
    { data: ticketRows },
    { data: blockedRows },
  ] = await Promise.all([
    applyRangeFilters(
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
    ),
    applyRangeFilters(
      supabase
        .from("call_logs")
        .select("outcome, duration_seconds")
        .eq("organization_id", organizationId),
    ),
    applyRangeFilters(
      supabase
        .from("call_logs")
        .select(
          "id, caller_number, caller_name, duration_seconds, outcome, ai_summary, created_at",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .range(listFrom, listTo),
    ),
    applyRangeFilters(
      supabase
        .from("call_logs")
        .select("id, caller_number, created_at")
        .eq("organization_id", organizationId),
    ),
    supabase
      .from("action_tickets")
      .select("id, caller_number, caller_name, summary, status, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(CALL_HISTORY_OPEN_TICKET_LIMIT),
    supabase
      .from("blocked_callers")
      .select("caller_e164")
      .eq("organization_id", organizationId),
  ]);

  const error = countError ?? metricsError ?? listError;

  const tickets = (ticketRows ?? []) as TicketDbRow[];
  const followUpByCallId = assignOpenTicketsToCalls(
    (linkRows ?? []) as CallLinkRow[],
    tickets,
  );
  const openTicketCount = tickets.filter((t) => t.status === "open").length;

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CALL_HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const metrics = buildCallHistoryMetricsFromSummaryRows(
    (metricsData ?? []) as CallLogMetricsRow[],
    openTicketCount,
  );
  if (total > 0) {
    metrics.totalCalls = total;
  }

  const blockedCallerE164s = (blockedRows ?? []).map(
    (row) => String((row as { caller_e164: string }).caller_e164),
  );
  const blockedSet = new Set(blockedCallerE164s);

  const calls = !error
    ? ((pageData ?? []) as CallLogListRow[]).map((row) =>
        toListItem(row, followUpByCallId, businessName, blockedSet),
      )
    : [];

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
      <DashboardAnimatedPageSections>
      <ClistePageHeader
        tone="calls"
        icon={Phone}
        title="Calls"
        description={greetingSubline}
        actions={<DashboardHeaderRangeControls />}
        summary={
          [
            { value: String(metrics.totalCalls), label: "total calls" },
            { value: String(metrics.routedCount), label: "routed" },
            { value: String(metrics.needsAttentionCount), label: "need attention" },
            { value: metrics.avgDurationLabel, label: "avg. length" },
          ]
        }
      />

      {error ? (
        <p className="shrink-0 text-[13px] text-red-700">
          Could not load calls: {error.message}
        </p>
      ) : (
        <CallHistoryView
          className="min-h-0 flex-1"
          calls={calls}
          metrics={metrics}
          initialSelectedCallId={initialSelectedCallId}
          blockedCallerE164s={blockedCallerE164s}
          businessName={businessName}
          pagination={{
            page,
            pageSize: CALL_HISTORY_PAGE_SIZE,
            totalCount: total,
            totalPages,
            rangeKey,
          }}
        />
      )}
      </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
