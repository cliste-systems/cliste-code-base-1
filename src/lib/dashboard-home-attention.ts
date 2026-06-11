import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import { normalizeCallOutcome, type CallOutcome } from "@/lib/call-history-types";
import { ticketCallerLabel } from "@/lib/dashboard-feed-time";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

/** Call outcomes that belong on Home Needs attention (even without an open ticket). */
const CALL_ATTENTION_OUTCOMES: readonly CallOutcome[] = [
  "callback_requested",
  "failed",
];

export type HomeAttentionCallRow = {
  id: string;
  created_at: string;
  outcome: string | null;
  caller_number: string | null;
  caller_name?: string | null;
};

export type HomeAttentionTicketRow = {
  id: string;
  summary: string | null;
  created_at: string;
  caller_name?: string | null;
  caller_number?: string | null;
};

export function isCallNeedingHomeAttention(outcome: string | null | undefined): boolean {
  return CALL_ATTENTION_OUTCOMES.includes(
    normalizeCallOutcome(String(outcome ?? "")),
  );
}

function attentionBadgeForCall(outcome: string | null): string {
  switch (normalizeCallOutcome(String(outcome ?? ""))) {
    case "callback_requested":
      return "Callback";
    case "failed":
      return "Missed";
    default:
      return "Open";
  }
}

/** Open tickets + calls that still need a follow-up (callback / missed). */
export function buildHomeAttentionItems(input: {
  openTickets: HomeAttentionTicketRow[];
  calls: HomeAttentionCallRow[];
  callerLabel: (row: HomeAttentionCallRow) => string;
  callOutcomeLabel: (outcome: string | null) => string;
  formatTime: (iso: string) => string;
}): TimelineFeedRow[] {
  type Row = TimelineFeedRow & { timestamp: number };

  const items: Row[] = [];

  for (const row of input.openTickets) {
    const ts = new Date(row.created_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const summary = row.summary?.replace(/\s+/g, " ").trim() || "Request captured";
    items.push({
      id: `ticket-${row.id}`,
      title: ticketCallerLabel(row),
      subtitle: summary,
      time: input.formatTime(row.created_at),
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(row.id)}`,
      badge: "Open",
      urgent: true,
      timestamp: ts,
    });
  }

  for (const row of input.calls) {
    if (!isCallNeedingHomeAttention(row.outcome)) continue;
    const ts = new Date(row.created_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const who = input.callerLabel(row);
    const outcomeLabel = input.callOutcomeLabel(row.outcome);
    items.push({
      id: `call-${row.id}`,
      title: `${who} — ${outcomeLabel}`,
      time: input.formatTime(row.created_at),
      href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(row.id)}`,
      badge: attentionBadgeForCall(row.outcome),
      urgent: true,
      timestamp: ts,
    });
  }

  return items
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ timestamp: _ts, ...row }) => row);
}
