import {
  classifyActionCategory,
  type ActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";
import {
  ATTENTION_TAG_AMBER_CLASS,
  ATTENTION_TAG_RED_CLASS,
  resolveAttentionTag,
} from "@/lib/call-attention-level";
import type { CallOutcome } from "@/lib/call-history-types";
import {
  isPostCallAttentionStatus,
  type PostCallStatus,
} from "@/lib/post-call-processing-types";

export type CallHistoryStatusTone = "resolved" | "follow_up" | "review";

export type CallResolution = "resolved" | "incomplete" | "needs_follow_up";

export function normalizeCallResolution(value: string | null | undefined): CallResolution | null {
  if (!value?.trim()) return null;
  const v = value.trim().toLowerCase();
  if (v === "resolved" || v === "incomplete" || v === "needs_follow_up") {
    return v;
  }
  return null;
}

export const CALL_HISTORY_STATUS_BADGE_CLASSES: Record<CallHistoryStatusTone, string> = {
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  follow_up: ATTENTION_TAG_AMBER_CLASS,
  review: ATTENTION_TAG_RED_CLASS,
};

export const CALL_HISTORY_STATUS_ROW_ACCENT_CLASSES: Record<
  CallHistoryStatusTone,
  { rowAccentClass: string; selectedRowAccentClass: string }
> = {
  resolved: {
    rowAccentClass: "border-l-[3px] border-l-emerald-500",
    selectedRowAccentClass: "border-l-4 border-l-emerald-500",
  },
  follow_up: {
    rowAccentClass: "border-l-[3px] border-l-amber-500",
    selectedRowAccentClass: "border-l-4 border-l-amber-500",
  },
  review: {
    rowAccentClass: "border-l-[3px] border-l-red-600",
    selectedRowAccentClass: "border-l-4 border-l-red-600",
  },
};

const FAILURE_OUTCOMES = new Set<CallOutcome>([
  "failed",
  "voicemail_or_no_speech",
  "spam_or_abuse",
  "blocked",
]);

const FOLLOW_UP_OUTCOMES = new Set<CallOutcome>(["action_created", "callback_requested"]);

const RESOLVED_OUTCOMES = new Set<CallOutcome>(["answered", "link_sent", "transferred"]);

const FAILURE_SUMMARY_RE =
  /\b(hung up|hang up|disconnected|cut off|dropped|no speech|silent|call failed|could not connect|couldn't connect|technical issue|didn.?t answer|abandoned|incomplete|unfinished|failed to|unable to help)\b/i;

/** Post-call copy for calls that did not finish an errand — not green Resolved. */
const INCOMPLETE_CALL_SUMMARY_RE =
  /\b(no specific request|without any action|without action taken|call ended without|ended without any action|no request was made|nothing was (needed|requested)|did not (ask|state|complete)|only (greeted|said hello|asked how)|incomplete conversation)\b/i;

const COMPLAINT_RE =
  /\b(complaint|unhappy|refund|disappointed|upset|manager|delivery never|never arrived)\b/i;

function reviewStatus(): { label: string; tone: "review" } {
  return { label: "Review", tone: "review" };
}

function resolvedStatus(): { label: string; tone: "resolved" } {
  return { label: "Resolved", tone: "resolved" };
}

function followUpStatus(
  summary: string,
  category: ActionCategory | null,
): { label: string; tone: CallHistoryStatusTone } {
  const effectiveCategory =
    summary && COMPLAINT_RE.test(summary) ? ("complaint" as const) : category;
  const tag = resolveAttentionTag({ level: "follow_up", category: effectiveCategory });
  const label = tag?.label ?? "Request";
  const tone: CallHistoryStatusTone =
    tag?.tagClassName === ATTENTION_TAG_RED_CLASS ? "review" : "follow_up";
  return { label, tone };
}

function isFailureCategory(category: ActionCategory): boolean {
  return category === "failed" || category === "unclear";
}

export function resolveCallHistoryStatus(input: {
  outcome: CallOutcome;
  summary: string | null;
  postCallStatus?: PostCallStatus | null;
  hasOpenAction?: boolean;
  callResolution?: CallResolution | null;
}): { label: string; tone: CallHistoryStatusTone } {
  const summary = input.summary?.trim() ?? "";
  const postCallStatus = input.postCallStatus ?? "complete";
  const category = summary ? classifyActionCategory(summary) : null;
  const callResolution = normalizeCallResolution(input.callResolution ?? null);

  if (FAILURE_OUTCOMES.has(input.outcome)) {
    return reviewStatus();
  }

  if (isPostCallAttentionStatus(postCallStatus) || postCallStatus === "pending") {
    return reviewStatus();
  }

  if (callResolution === "incomplete") {
    return reviewStatus();
  }

  if (summary && FAILURE_SUMMARY_RE.test(summary)) {
    return reviewStatus();
  }

  if (!callResolution && summary && INCOMPLETE_CALL_SUMMARY_RE.test(summary)) {
    return reviewStatus();
  }

  if (category && isFailureCategory(category)) {
    return reviewStatus();
  }

  if (input.hasOpenAction || FOLLOW_UP_OUTCOMES.has(input.outcome)) {
    return followUpStatus(summary, category);
  }

  if (!summary) {
    if (RESOLVED_OUTCOMES.has(input.outcome) && postCallStatus === "complete") {
      return resolvedStatus();
    }
    return reviewStatus();
  }

  if (RESOLVED_OUTCOMES.has(input.outcome) && postCallStatus === "complete") {
    return resolvedStatus();
  }

  return reviewStatus();
}

export function resolveCallHistoryListStatus(input: {
  outcome: CallOutcome;
  aiSummary: string | null;
  postCallStatus?: PostCallStatus | null;
  followUpSummary?: string | null;
  hasOpenAction?: boolean;
  callResolution?: CallResolution | null;
}): { label: string; tone: CallHistoryStatusTone } {
  const summary = input.aiSummary?.trim() || input.followUpSummary?.trim() || null;
  return resolveCallHistoryStatus({
    outcome: input.outcome,
    summary,
    postCallStatus: input.postCallStatus,
    hasOpenAction: input.hasOpenAction,
    callResolution: input.callResolution,
  });
}

/** Matches non-resolved list badges — orders, complaints, callbacks, review, etc. */
export function resolveCallHistoryNeedsAttention(input: {
  outcome: CallOutcome;
  aiSummary?: string | null;
  postCallStatus?: PostCallStatus | null;
  followUpSummary?: string | null;
  hasOpenAction?: boolean;
  callResolution?: CallResolution | null;
}): boolean {
  return (
    resolveCallHistoryListStatus({
      outcome: input.outcome,
      aiSummary: input.aiSummary ?? null,
      postCallStatus: input.postCallStatus,
      followUpSummary: input.followUpSummary ?? null,
      hasOpenAction: input.hasOpenAction,
      callResolution: input.callResolution,
    }).tone !== "resolved"
  );
}
