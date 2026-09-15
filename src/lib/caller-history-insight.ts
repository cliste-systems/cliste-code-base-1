import {
  inferCallIntent,
  normalizeCallOutcome,
  type CallOutcome,
} from "@/lib/call-history-types";
import { ANONYMOUS_CALLER_E164 } from "@/lib/blocked-callers";

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
};

export type CallerHistoryTicketInput = {
  status: string;
  summary: string;
  departmentSlug: string | null;
};

export type CallerHistoryRecentCall = {
  id: string;
  dateLabel: string;
  summaryPreview: string | null;
  intentLabel: string;
};

export type CallerHistoryInsight =
  | { kind: "anonymous" }
  | {
      kind: "first_call";
      isBlocked: boolean;
      securityFlags: CallerHistorySecurityFlag[];
    }
  | {
      kind: "repeat";
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

export function buildCallerHistoryInsight(input: {
  callerNumber: string;
  calls: CallerHistoryCallInput[];
  openTickets: CallerHistoryTicketInput[];
  isBlocked: boolean;
  now?: Date;
}): CallerHistoryInsight {
  const caller = input.callerNumber.trim();
  if (!caller || caller === ANONYMOUS_CALLER_E164) {
    return { kind: "anonymous" };
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
    return {
      kind: "first_call",
      isBlocked: input.isBlocked,
      securityFlags,
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
    return {
      id: call.id,
      dateLabel: formatCallerHistoryDateLabel(call.createdAt, now),
      summaryPreview: summaryPreview(summary),
      intentLabel: inferCallIntent(summary, outcome),
    };
  });

  return {
    kind: "repeat",
    totalCalls,
    firstCallLabel: formatCallerHistoryDateLabel(oldest.createdAt, now),
    lastCallLabel: formatCallerHistoryDateLabel(newest.createdAt, now),
    knownNames,
    openFollowUps,
    isBlocked: input.isBlocked,
    securityFlags,
    recentCalls,
  };
}

export const CALLER_HISTORY_FLAG_LABELS: Record<CallerHistorySecurityFlag, string> = {
  blocked: "Blocked",
  frequent_caller: "Frequent caller",
  high_volume_today: "High volume today",
  multiple_names: "Multiple names used",
  open_complaints: "Open complaints",
};
