import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  activityFeedCallerLabel,
  callerLiveActivityLabel,
  formatDashboardFeedRelativeTime,
} from "@/lib/dashboard-feed-time";
import { formatActivityFeedBadge } from "@/lib/dashboard-live-activity";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  ENGINEER_TEST_CALL_BRAND,
  ENGINEER_TEST_CALL_LIST_LABEL,
  ENGINEER_TEST_CALL_ROW_SUBTITLE,
  isEngineerTestCallRow,
} from "@/lib/engineer-test-call";

function isEngineerTestActivityCall(row: ActivityFeedSourceCall): boolean {
  return isEngineerTestCallRow({
    engineer_test_call: row.engineer_test_call,
    caller_number: row.caller_number,
  });
}

/** One HelloCara Engineer row in live activity (latest test, rest hidden). */
function collapseEngineerTestCallsForLiveActivity(
  calls: ActivityFeedSourceCall[],
): ActivityFeedSourceCall[] {
  const sorted = [...calls].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const engineer = sorted.filter((row) => isEngineerTestActivityCall(row));
  const rest = sorted.filter((row) => !isEngineerTestActivityCall(row));
  if (engineer.length <= 1) return sorted;
  return [engineer[0]!, ...rest];
}

export type ActivityFeedSourceCall = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
  caller_data_erased_at?: string | null;
  ai_summary?: string | null;
  engineer_test_call?: boolean | null;
};

export type ActivityFeedSourceTicket = {
  id: string;
  created_at: string;
  caller_name?: string | null;
  caller_number?: string | null;
  caller_data_erased_at?: string | null;
  summary?: string | null;
  brief_summary?: string | null;
};

function ticketSummaryForBadge(row: ActivityFeedSourceTicket): string | null {
  return row.summary?.trim() || row.brief_summary?.trim() || null;
}

/** Overview Live activity — incoming calls only, first name + number. */
export function buildHomeLiveActivityFeed(input: {
  calls: ActivityFeedSourceCall[];
  formatTime?: (iso: string) => string;
  limit?: number;
}): TimelineFeedRow[] {
  const limit = input.limit ?? 200;
  const formatTime = input.formatTime ?? formatDashboardFeedRelativeTime;

  const collapsed = collapseEngineerTestCallsForLiveActivity(input.calls);
  const engineerCount = input.calls.filter((row) =>
    isEngineerTestActivityCall(row),
  ).length;

  return collapsed
    .slice(0, limit)
    .map((row) => {
      const engineerTestCall = isEngineerTestActivityCall(row);
      const label = engineerTestCall
        ? {
            title: ENGINEER_TEST_CALL_LIST_LABEL,
            subtitle:
              engineerCount > 1
                ? `${engineerCount} test calls today`
                : ENGINEER_TEST_CALL_ROW_SUBTITLE,
          }
        : callerLiveActivityLabel(row);
      return {
        id: `${row.id}-call`,
        title: label.title,
        subtitle: label.subtitle,
        time: formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
        isoDate: row.created_at,
      };
    });
}

/** Full activity page — calls and inbox items with action labels. */
export function buildDashboardActivityFeed(input: {
  calls: ActivityFeedSourceCall[];
  tickets: ActivityFeedSourceTicket[];
  formatTime: (iso: string) => string;
  limit?: number;
}): TimelineFeedRow[] {
  const limit = input.limit ?? 200;

  const rows: (TimelineFeedRow & { timestamp: number })[] = [
    ...input.calls.map((row) => {
      const action = row.engineer_test_call
        ? ENGINEER_TEST_CALL_BRAND
        : formatActivityFeedBadge({
            summary: row.ai_summary,
            outcome: row.outcome,
          });
      return {
        id: `${row.id}-call`,
        title: row.engineer_test_call
          ? ENGINEER_TEST_CALL_LIST_LABEL
          : activityFeedCallerLabel(row),
        time: input.formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
        badge: action,
        isoDate: row.created_at,
        timestamp: new Date(row.created_at).getTime(),
      };
    }),
    ...input.tickets.map((row) => {
      const action = formatActivityFeedBadge({
        summary: ticketSummaryForBadge(row),
      });
      return {
        id: `${row.id}-ticket`,
        title: activityFeedCallerLabel(row),
        time: input.formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(row.id)}`,
        badge: action,
        isoDate: row.created_at,
        timestamp: new Date(row.created_at).getTime(),
      };
    }),
  ]
    .filter((row) => Number.isFinite(row.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return rows.map(({ timestamp: _timestamp, ...row }) => row);
}
