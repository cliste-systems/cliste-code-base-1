import { Phone } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardInlineSummary } from "@/components/dashboard/dashboard-inline-summary";
import {
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_GLYPH_LG,
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

import { DashboardHeaderRangeControls } from "../dashboard-header-range-controls";
import {
  buildCallHistoryMetricsFromSummaryRows,
  type CallFollowUp,
  type CallHistoryListItem,
  summaryForDisplay,
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

function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

function buildFollowUpMap(tickets: TicketDbRow[]): Map<string, CallFollowUp> {
  const openByKey = new Map<string, CallFollowUp>();
  for (const t of tickets) {
    if (t.status !== "open") continue;
    const key = phoneKey(t.caller_number);
    if (!key || openByKey.has(key)) continue;
    openByKey.set(key, {
      id: t.id,
      summary: t.summary,
      status: "open",
    });
  }
  return openByKey;
}

function parsePageParam(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function toListItem(
  row: CallLogListRow,
  openFollowUpByKey: Map<string, CallFollowUp>,
): CallHistoryListItem {
  const mapped = mapCallLogToRow({
    ...row,
    transcript: null,
    transcript_review: null,
  });
  const key = phoneKey(mapped.callerId);
  const followUp = key ? (openFollowUpByKey.get(key) ?? null) : null;
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
  item.summaryPreview = summaryForDisplay(item);
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
    { data: ticketRows },
    { data: org },
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
    supabase
      .from("action_tickets")
      .select("id, caller_number, caller_name, summary, status, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(CALL_HISTORY_OPEN_TICKET_LIMIT),
    supabase
      .from("organizations")
      .select("is_active")
      .eq("id", organizationId)
      .maybeSingle(),
  ]);

  const error = countError ?? metricsError ?? listError;

  const openFollowUpByKey = buildFollowUpMap((ticketRows ?? []) as TicketDbRow[]);

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CALL_HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const metrics = buildCallHistoryMetricsFromSummaryRows(
    (metricsData ?? []) as CallLogMetricsRow[],
    openFollowUpByKey.size,
  );
  if (total > 0) {
    metrics.totalCalls = total;
  }

  const calls = !error
    ? ((pageData ?? []) as CallLogListRow[]).map((row) =>
        toListItem(row, openFollowUpByKey),
      )
    : [];

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <DashboardAnimatedPageSections>
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <span className={DASHBOARD_ICON_CHIP_LG}>
              <Phone className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[26px]">
                Calls
              </h1>
              <p className="mt-0.5 text-[13px] text-slate-500">{greetingSubline}</p>
            </div>
          </div>
          <DashboardInlineSummary
            segments={[
              { value: String(metrics.totalCalls), label: "total calls" },
              { value: String(metrics.routedCount), label: "routed" },
              { value: String(metrics.needsAttentionCount), label: "need attention" },
              { value: metrics.avgDurationLabel, label: "avg. length" },
            ]}
          />
        </div>
        <DashboardHeaderRangeControls caraActive={org?.is_active !== false} />
      </header>

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
  );
}
