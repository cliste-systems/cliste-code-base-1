import { normalizeCallOutcome } from "@/lib/call-history-types";
import {
  normalizeCallResolution,
  resolveCallHistoryListStatus,
} from "@/lib/call-history-status";
import { ticketCallerLabel } from "@/lib/dashboard-feed-time";
import { truncateHomePanelDescription } from "@/lib/dashboard-home-requests";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type { PostCallStatus } from "@/lib/post-call-processing-types";

export type HomeCallReviewRow = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  time: string;
};

export type HomeCallReviewInput = {
  id: string;
  created_at: string;
  outcome: string | null;
  ai_summary?: string | null;
  post_call_status?: string | null;
  call_resolution?: string | null;
  caller_name?: string | null;
  caller_number?: string | null;
};

export function countHomeCallsToReview(calls: HomeCallReviewInput[]): number {
  return buildHomeCallsToReviewRows({
    calls,
    formatTime: () => "",
    limit: Number.MAX_SAFE_INTEGER,
  }).length;
}

export function buildHomeCallsToReviewRows(input: {
  calls: HomeCallReviewInput[];
  formatTime: (iso: string) => string;
  limit?: number;
}): HomeCallReviewRow[] {
  const limit = input.limit ?? 3;
  const rows: HomeCallReviewRow[] = [];

  for (const call of input.calls) {
    const status = resolveCallHistoryListStatus({
      outcome: normalizeCallOutcome(String(call.outcome ?? "")),
      aiSummary: call.ai_summary ?? null,
      postCallStatus: (call.post_call_status ?? null) as PostCallStatus | null,
      callResolution: normalizeCallResolution(call.call_resolution),
    });
    if (status.tone !== "review") continue;

    const summary = truncateHomePanelDescription(call.ai_summary) || status.label;
    rows.push({
      id: call.id,
      href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(call.id)}`,
      title: ticketCallerLabel(call),
      subtitle: summary,
      time: input.formatTime(call.created_at),
    });
  }

  return rows.slice(0, limit);
}
