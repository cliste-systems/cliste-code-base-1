import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import {
  formatLiveActivityCallAction,
  formatLiveActivityTicketAction,
} from "@/lib/dashboard-live-activity";
import { ticketCallerLabel } from "@/lib/dashboard-feed-time";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export type ActivityFeedSourceCall = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
  ai_summary?: string | null;
};

export type ActivityFeedSourceTicket = {
  id: string;
  created_at: string;
  caller_name?: string | null;
  caller_number?: string | null;
};

function callerLabelFor(row: ActivityFeedSourceCall): string {
  const name = row.caller_name?.trim();
  if (name) return name;
  const phone = row.caller_number?.trim();
  if (phone) return phone;
  return "Unknown caller";
}

/** Merged feed of what Cara did — calls, deliveries, captured requests. */
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
        subtitle: action,
        time: input.formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
        badge: action,
        timestamp: new Date(row.created_at).getTime(),
      };
    }),
    ...input.tickets.map((row) => {
      const action = formatLiveActivityTicketAction();
      return {
        id: `${row.id}-ticket`,
        title: ticketCallerLabel(row),
        subtitle: action,
        time: input.formatTime(row.created_at),
        href: `${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(row.id)}`,
        badge: action,
        timestamp: new Date(row.created_at).getTime(),
      };
    }),
  ]
    .filter((row) => Number.isFinite(row.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return rows.map(({ timestamp: _timestamp, ...row }) => row);
}
