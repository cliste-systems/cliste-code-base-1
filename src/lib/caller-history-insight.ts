import {
  classifyActionCategory,
} from "@/app/(dashboard)/dashboard/action-inbox/categories";
import {
  inferCallIntent,
  normalizeCallOutcome,
  type CallOutcome,
} from "@/lib/call-history-types";
import { resolveCallHistoryStatus, type CallHistoryStatusTone } from "@/lib/call-history-status";
import {
  assessCallerSecurityLevel,
  callerSecurityOverviewPrefix,
  type CallerSecurityAssessment,
} from "@/lib/caller-security-level";
import { ANONYMOUS_CALLER_E164 } from "@/lib/blocked-callers";
import {
  callerDataErasureSummary,
  pickCallerDataErasureAudit,
  type CallerDataErasureAudit,
} from "@/lib/caller-data-erasure";
import type { PostCallStatus } from "@/lib/post-call-processing-types";

export type {
  CallHistoryStatusTone as CallerHistoryRecentCallStatusTone,
} from "@/lib/call-history-status";
export {
  CALL_HISTORY_STATUS_BADGE_CLASSES as CALLER_HISTORY_STATUS_BADGE_CLASSES,
  CALL_HISTORY_STATUS_ROW_ACCENT_CLASSES as CALLER_HISTORY_STATUS_ROW_ACCENT_CLASSES,
  resolveCallHistoryListStatus,
  resolveCallHistoryStatus as resolveCallerHistoryRecentCallStatus,
} from "@/lib/call-history-status";

export type CallerHistorySecurityFlag =
  | "blocked"
  | "frequent_caller"
  | "high_volume_today"
  | "multiple_names"
  | "open_complaints";

export type CallerHistoryCallInput = {
  id: string;
  createdAt: string;
  callerName: string | null;
  outcome: string;
  aiSummary: string | null;
  durationSeconds: number;
  postCallStatus?: PostCallStatus | null;
};

export type CallerHistoryTicketInput = {
  status: string;
  summary: string;
  departmentSlug: string | null;
};

export type CallerHistoryRecentCall = {
  id: string;
  createdAt: string;
  dateLabel: string;
  summary: string | null;
  intentLabel: string;
  statusLabel: string;
  statusTone: CallHistoryStatusTone;
};

export type CallerHistoryInsight =
  | {
      kind: "erased";
      overview: string;
      audit: Required<
        Pick<CallerDataErasureAudit, "erasedAt" | "erasedByLabel" | "erasedReason">
      >;
    }
  | { kind: "anonymous"; overview: string; security: CallerSecurityAssessment }
  | {
      kind: "first_call";
      overview: string;
      security: CallerSecurityAssessment;
      isBlocked: boolean;
      securityFlags: CallerHistorySecurityFlag[];
    }
  | {
      kind: "repeat";
      overview: string;
      security: CallerSecurityAssessment;
      totalCalls: number;
      firstCallLabel: string;
      lastCallLabel: string;
      knownNames: string[];
      openFollowUps: number;
      isBlocked: boolean;
      securityFlags: CallerHistorySecurityFlag[];
      recentCalls: CallerHistoryRecentCall[];
    };

const RECENT_CALL_LIMIT = 5;
const FREQUENT_CALLER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FREQUENT_CALLER_MIN = 5;
const HIGH_VOLUME_WINDOW_MS = 24 * 60 * 60 * 1000;
const HIGH_VOLUME_MIN = 3;

const COMPLAINT_RE =
  /\b(complaint|unhappy|refund|disappointed|upset|manager|delivery never|never arrived)\b/i;

export function formatCallerHistoryDateLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";

  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

export function summaryPreview(text: string | null | undefined, max = 120): string | null {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

function normalizeCallerName(raw: string | null | undefined): string | null {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower === "unknown caller" || lower === "unknown") return null;
  return name;
}

function collectKnownNames(calls: CallerHistoryCallInput[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const call of calls) {
    const name = normalizeCallerName(call.callerName);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function countCallsSince(calls: CallerHistoryCallInput[], sinceMs: number, nowMs: number): number {
  return calls.filter((call) => {
    const ts = new Date(call.createdAt).getTime();
    return Number.isFinite(ts) && ts >= sinceMs && ts <= nowMs;
  }).length;
}

function isOpenComplaintTicket(ticket: CallerHistoryTicketInput): boolean {
  if (ticket.status === "resolved") return false;
  const slug = String(ticket.departmentSlug ?? "").toLowerCase();
  if (slug.includes("management")) return true;
  return COMPLAINT_RE.test(String(ticket.summary ?? ""));
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function callerSubject(knownNames: string[]): string {
  if (knownNames.length === 1) return knownNames[0]!;
  if (knownNames.length > 1) {
    return `${knownNames[0]} (also used ${knownNames.slice(1).join(", ")})`;
  }
  return "This caller";
}

function callerThemeForCall(call: CallerHistoryCallInput): string {
  const outcome = normalizeCallOutcome(call.outcome) as CallOutcome;
  const summary = call.aiSummary?.trim() ?? "";

  if (outcome === "callback_requested") return "callbacks";
  if (outcome === "link_sent") return "store information";
  if (COMPLAINT_RE.test(summary)) return "complaints";

  if (
    /(hours|open|close|location|address|directions|toilet|parking|information|availability)/i.test(
      summary,
    )
  ) {
    return "store information";
  }

  const category = summary ? classifyActionCategory(summary) : null;
  switch (category) {
    case "order":
      return "bakery orders";
    case "booking_request":
      return "bookings";
    case "callback":
      return "callbacks";
    case "quote":
      return "price enquiries";
    case "complaint":
      return "complaints";
    case "urgent":
      return "urgent issues";
    default:
      break;
  }

  if (outcome === "action_created") return "follow-ups";
  return "general enquiries";
}

function summarizeCallerThemes(calls: CallerHistoryCallInput[], maxItems = 3): string | null {
  const counts = new Map<string, number>();

  for (const call of calls.slice(0, 12)) {
    const theme = callerThemeForCall(call);
    counts.set(theme, (counts.get(theme) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([theme]) => theme)
    .slice(0, maxItems);

  if (ranked.length === 0) return null;
  return joinNatural(ranked);
}

export function buildErasedCallerHistoryInsight(
  audit: CallerDataErasureAudit | null | undefined,
): Extract<CallerHistoryInsight, { kind: "erased" }> {
  const normalized = pickCallerDataErasureAudit(audit);
  return {
    kind: "erased",
    audit: normalized,
    overview: callerDataErasureSummary(normalized),
  };
}

export function buildCallerHistoryOverview(
  insight: CallerHistoryInsight,
  callsForTopics: CallerHistoryCallInput[] = [],
): string {
  if (insight.kind === "erased") {
    return insight.overview;
  }

  const securityPrefix = callerSecurityOverviewPrefix(insight.security);
  let body = "";

  if (insight.kind === "anonymous") {
    body = "This number is withheld, so Cara can't build a caller history.";
  } else if (insight.kind === "first_call") {
    if (insight.isBlocked) {
      body =
        "First call from this number. The caller is currently blocked from reaching Cara.";
    } else {
      body = "First call from this number. Cara will build a clearer picture if they call again.";
    }
  } else {
    const subject = callerSubject(insight.knownNames);
    const callCount = `${insight.totalCalls} call${insight.totalCalls === 1 ? "" : "s"}`;
    const timeline =
      insight.firstCallLabel === insight.lastCallLabel
        ? ["today", "yesterday"].includes(insight.lastCallLabel.toLowerCase())
          ? insight.lastCallLabel.toLowerCase()
          : `on ${insight.lastCallLabel.toLowerCase()}`
        : `since ${insight.firstCallLabel.toLowerCase()}, most recently ${insight.lastCallLabel.toLowerCase()}`;
    const sentences: string[] = [`${subject} has made ${callCount} ${timeline}.`];

    const themes = summarizeCallerThemes(callsForTopics);
    if (themes) {
      sentences.push(`Mostly ${themes}.`);
    }

    if (insight.openFollowUps > 0) {
      sentences.push(
        `${insight.openFollowUps} open request${insight.openFollowUps === 1 ? "" : "s"} ${insight.openFollowUps === 1 ? "is" : "are"} still on file.`,
      );
    }

    if (insight.isBlocked) {
      sentences.push("This number is currently blocked.");
    }

    body = sentences.join(" ");
  }

  if (securityPrefix) {
    return `${securityPrefix} ${body}`;
  }
  return body;
}

function buildCallerSecurityAssessment(input: {
  isBlocked: boolean;
  abuseHitCount: number;
  openFollowUps: number;
  securityFlags: CallerHistorySecurityFlag[];
  calls: CallerHistoryCallInput[];
  now?: Date;
}): CallerSecurityAssessment {
  return assessCallerSecurityLevel({
    isBlocked: input.isBlocked,
    abuseHitCount: input.abuseHitCount,
    openFollowUps: input.openFollowUps,
    securityFlags: input.securityFlags,
    calls: input.calls.map((call) => ({
      outcome: call.outcome,
      aiSummary: call.aiSummary,
      durationSeconds: call.durationSeconds,
      createdAt: call.createdAt,
    })),
    now: input.now,
  });
}

export function buildCallerHistoryInsight(input: {
  callerNumber: string;
  calls: CallerHistoryCallInput[];
  openTickets: CallerHistoryTicketInput[];
  isBlocked: boolean;
  abuseHitCount?: number;
  now?: Date;
}): CallerHistoryInsight {
  const caller = input.callerNumber.trim();
  const abuseHitCount = Math.max(0, input.abuseHitCount ?? 0);
  const lowSecurity = buildCallerSecurityAssessment({
    isBlocked: false,
    abuseHitCount: 0,
    openFollowUps: 0,
    securityFlags: [],
    calls: [],
    now: input.now,
  });

  if (!caller || caller === ANONYMOUS_CALLER_E164) {
    const anonymousInsight = {
      kind: "anonymous" as const,
      overview: "",
      security: lowSecurity,
    };
    return {
      ...anonymousInsight,
      overview: buildCallerHistoryOverview(anonymousInsight),
    };
  }

  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const calls = [...input.calls].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const totalCalls = calls.length;
  const securityFlags: CallerHistorySecurityFlag[] = [];

  if (input.isBlocked) {
    securityFlags.push("blocked");
  }

  const openFollowUps = input.openTickets.filter((t) => t.status !== "resolved").length;
  if (input.openTickets.some(isOpenComplaintTicket)) {
    securityFlags.push("open_complaints");
  }

  if (totalCalls <= 1) {
    const security = buildCallerSecurityAssessment({
      isBlocked: input.isBlocked,
      abuseHitCount,
      openFollowUps,
      securityFlags,
      calls,
      now,
    });
    const firstCallInsight = {
      kind: "first_call" as const,
      isBlocked: input.isBlocked,
      securityFlags,
      security,
      overview: "",
    };
    return {
      ...firstCallInsight,
      overview: buildCallerHistoryOverview(firstCallInsight, calls),
    };
  }

  const knownNames = collectKnownNames(calls);
  if (knownNames.length > 1) {
    securityFlags.push("multiple_names");
  }

  const frequentSince = nowMs - FREQUENT_CALLER_WINDOW_MS;
  if (countCallsSince(calls, frequentSince, nowMs) >= FREQUENT_CALLER_MIN) {
    securityFlags.push("frequent_caller");
  }

  const volumeSince = nowMs - HIGH_VOLUME_WINDOW_MS;
  if (countCallsSince(calls, volumeSince, nowMs) >= HIGH_VOLUME_MIN) {
    securityFlags.push("high_volume_today");
  }

  const oldest = calls[calls.length - 1];
  const newest = calls[0];

  const recentCalls: CallerHistoryRecentCall[] = calls.slice(0, RECENT_CALL_LIMIT).map((call) => {
    const outcome = normalizeCallOutcome(call.outcome) as CallOutcome;
    const summary = call.aiSummary?.trim() || null;
    const status = resolveCallHistoryStatus({
      outcome,
      summary,
      postCallStatus: call.postCallStatus,
    });
    return {
      id: call.id,
      createdAt: call.createdAt,
      dateLabel: formatCallerHistoryDateLabel(call.createdAt, now),
      summary,
      intentLabel: inferCallIntent(summary, outcome),
      statusLabel: status.label,
      statusTone: status.tone,
    };
  });

  const repeatBase = {
    kind: "repeat" as const,
    totalCalls,
    firstCallLabel: formatCallerHistoryDateLabel(oldest.createdAt, now),
    lastCallLabel: formatCallerHistoryDateLabel(newest.createdAt, now),
    knownNames,
    openFollowUps,
    isBlocked: input.isBlocked,
    securityFlags,
    recentCalls,
    security: buildCallerSecurityAssessment({
      isBlocked: input.isBlocked,
      abuseHitCount,
      openFollowUps,
      securityFlags,
      calls,
      now,
    }),
    overview: "",
  };

  return {
    ...repeatBase,
    overview: buildCallerHistoryOverview(repeatBase, calls),
  };
}

export const CALLER_HISTORY_FLAG_LABELS: Record<CallerHistorySecurityFlag, string> = {
  blocked: "Blocked",
  frequent_caller: "Frequent caller",
  high_volume_today: "High volume today",
  multiple_names: "Multiple names used",
  open_complaints: "Open complaints",
};
