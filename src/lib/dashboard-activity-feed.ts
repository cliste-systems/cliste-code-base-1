import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  callerLiveActivityLabel,
  formatDashboardFeedRelativeTime,
  ticketCallerLabel,
} from "@/lib/dashboard-feed-time";
import {
  formatLiveActivityCallAction,
  formatLiveActivityTicketAction,
} from "@/lib/dashboard-live-activity";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export type ActivityFeedSourceCall = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
  caller_data_erased_at?: string | null;
  ai_summary?: string | null;
};

export type ActivityFeedSourceTicket = {
  id: string;
  created_at: string;
  caller_name?: string | null;
  caller_number?: string | null;
};

function callerLabelFor(row: ActivityFeedSourceCall): string {
  return ticketCallerLabel(row);
}

/** Overview Live activity — incoming calls only, first name + number. */
export function buildHomeLiveActivityFeed(input: {
  calls: ActivityFeedSourceCall[];
  formatTime?: (iso: string) => string;
  limit?: number;
}): TimelineFeedRow[] {
  const limit = input.limit ?? 200;
  const formatTime = input.formatTime ?? formatDashboardFeedRelativeTime;

  return [...input.calls]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit)
    .map((row) => {
      const label = callerLiveActivityLabel(row);
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
      const action = formatLiveActivityCallAction(row.outcome, row.ai_summary);
      return {
        id: `${row.id}-call`,
        title: callerLabelFor(row),
        time: input.formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
        badge: action,
        isoDate: row.created_at,
        timestamp: new Date(row.created_at).getTime(),
      };
    }),
    ...input.tickets.map((row) => {
      const action = formatLiveActivityTicketAction();
      return {
        id: `${row.id}-ticket`,
        title: ticketCallerLabel(row),
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
