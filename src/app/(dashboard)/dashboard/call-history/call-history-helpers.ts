import type { StatusVariant } from "@/components/dashboard/dashboard-surface";
import { resolveCallerDisplayName } from "@/lib/caller-identity";
import {
  normalizeCallOutcome,
  type CallOutcome,
} from "@/lib/call-history-types";
import { isRoutedCallOutcome } from "@/lib/dashboard-routed-outcomes";

export type CallFollowUp = {
  id: string;
  summary: string;
  status: "open" | "resolved";
};

export type CallHistoryListItem = {
  id: string;
  createdAt: string;
  dateTimeLabel: string;
  callerId: string;
  callerDisplay: string;
  callerName: string | null;
  durationSeconds: number;
  durationLabel: string;
  outcome: CallOutcome;
  outcomeLabel: string;
  intentLabel: string;
  summaryPreview: string | null;
  transcriptVerbatim: string;
  transcriptReview: string | null;
  aiSummary: string | null;
  hasOpenAction: boolean;
  followUp: CallFollowUp | null;
};

export function callDisplayName(
  item: Pick<CallHistoryListItem, "callerName" | "callerDisplay">,
): string {
  return resolveCallerDisplayName([item.callerName], item.callerDisplay);
}

export function summaryForDisplay(item: CallHistoryListItem): string | null {
  if (item.aiSummary?.trim()) return item.aiSummary.trim();
  const review = item.transcriptReview?.trim();
  if (review) return truncatePreview(review, 160);
  const verbatim = item.transcriptVerbatim.trim();
  if (verbatim && verbatim !== "No transcript on file.") {
    return truncatePreview(verbatim, 160);
  }
  return null;
}

export function transcriptForDisplay(item: CallHistoryListItem): string | null {
  const review = item.transcriptReview?.trim();
  if (review) return review;
  const verbatim = item.transcriptVerbatim.trim();
  if (verbatim && verbatim !== "No transcript on file.") return verbatim;
  return null;
}

function truncatePreview(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export function whatHappenedNextLabel(
  outcome: CallOutcome,
  hasOpenAction: boolean,
): string {
  if (hasOpenAction) return "Needs attention";
  switch (outcome) {
    case "answered":
      return "Handled";
    case "link_sent":
      return "Routed";
    case "action_created":
      return "Follow-up created";
    case "callback_requested":
      return "Callback requested";
    case "failed":
      return "Failed";
    case "voicemail_or_no_speech":
      return "Handled";
    case "spam_or_abuse":
      return "Handled";
    default:
      return "Handled";
  }
}

export function actionStatusLabel(
  hasOpenAction: boolean,
  outcome: CallOutcome,
): string {
  if (hasOpenAction) return "Needs attention";
  if (outcome === "action_created" || outcome === "callback_requested") {
    return "Follow-up added";
  }
  return "Handled";
}

export function isNeedsAttentionCall(item: CallHistoryListItem): boolean {
  return item.hasOpenAction;
}

/** Quiet colour for an outcome chip — colour conveys meaning only. */
export function outcomeBadgeVariant(outcome: CallOutcome): StatusVariant {
  switch (outcome) {
    case "answered":
      return "success";
    case "link_sent":
    case "callback_requested":
    case "action_created":
      return "info";
    case "failed":
    case "spam_or_abuse":
      return "attention";
    case "voicemail_or_no_speech":
    default:
      return "neutral";
  }
}

export function isRoutedCall(item: CallHistoryListItem): boolean {
  return isRoutedCallOutcome(item.outcome);
}

export function averageDurationSeconds(calls: CallHistoryListItem[]): number {
  if (calls.length === 0) return 0;
  const total = calls.reduce((acc, c) => acc + Math.max(0, c.durationSeconds), 0);
  return Math.round(total / calls.length);
}

export function formatAvgDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export type OutcomeFilterValue =
  | "all"
  | CallOutcome
  | "needs_attention";

export const OUTCOME_FILTER_OPTIONS: { value: OutcomeFilterValue; label: string }[] = [
  { value: "all", label: "All outcomes" },
  { value: "answered", label: "Answered" },
  { value: "link_sent", label: "Routed" },
  { value: "action_created", label: "Request captured" },
  { value: "callback_requested", label: "Callback requested" },
  { value: "failed", label: "Failed" },
  { value: "voicemail_or_no_speech", label: "No speech" },
  { value: "spam_or_abuse", label: "Spam or abuse" },
  { value: "needs_attention", label: "Needs attention" },
];

export function matchesOutcomeFilter(
  item: CallHistoryListItem,
  filter: OutcomeFilterValue,
): boolean {
  if (filter === "all") return true;
  if (filter === "needs_attention") return item.hasOpenAction;
  return item.outcome === filter;
}

export function matchesSearch(item: CallHistoryListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qDigits = q.replace(/\D/g, "");
  const hay = [
    item.callerName ?? "",
    item.callerDisplay,
    item.callerId,
    item.intentLabel,
    item.summaryPreview ?? "",
    item.aiSummary ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  if (qDigits.length >= 4 && item.callerId.replace(/\D/g, "").includes(qDigits)) {
    return true;
  }
  return false;
}

export function normalizeOutcomeForMetrics(raw: string | null | undefined): CallOutcome {
  return normalizeCallOutcome(String(raw ?? ""));
}

export type CallHistoryMetrics = {
  totalCalls: number;
  routedCount: number;
  needsAttentionCount: number;
  avgDurationLabel: string;
};

export function buildCallHistoryMetrics(calls: CallHistoryListItem[]): CallHistoryMetrics {
  const routedCount = calls.filter(
    (c) =>
      c.outcome === "link_sent" ||
      c.outcome === "callback_requested" ||
      c.outcome === "action_created",
  ).length;
  const needsAttentionCount = calls.filter((c) => c.hasOpenAction).length;
  return {
    totalCalls: calls.length,
    routedCount,
    needsAttentionCount,
    avgDurationLabel: formatAvgDuration(averageDurationSeconds(calls)),
  };
}
