import type { CallerHistorySecurityFlag } from "@/lib/caller-history-insight";
import { normalizeCallOutcome } from "@/lib/call-history-types";

export type CallerSecurityLevel = "low" | "watch" | "elevated" | "high";

export type CallerSecurityReason = {
  code: string;
  label: string;
  level: CallerSecurityLevel;
};

export type CallerSecurityAssessment = {
  level: CallerSecurityLevel;
  reasons: CallerSecurityReason[];
  recommendation: string | null;
};

export type CallerSecurityCallInput = {
  outcome: string;
  aiSummary: string | null;
  durationSeconds: number;
  createdAt: string;
};

export type CallerSecurityAssessmentInput = {
  isBlocked: boolean;
  abuseHitCount: number;
  openFollowUps: number;
  securityFlags: CallerHistorySecurityFlag[];
  calls: CallerSecurityCallInput[];
  now?: Date;
};

const LEVEL_RANK: Record<CallerSecurityLevel, number> = {
  low: 0,
  watch: 1,
  elevated: 2,
  high: 3,
};

const FREQUENT_CALLER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HIGH_VOLUME_WINDOW_MS = 24 * 60 * 60 * 1000;
const TIME_WASTER_MIN_CALLS = 5;
const TIME_WASTER_MAX_AVG_SECONDS = 15;
const ROBocall_SAMPLE_SIZE = 8;
const ROBocall_MIN_RATIO = 0.5;

const SCAM_LANGUAGE_RE =
  /\b(gift card|verification code|one.?time.?password|\botp\b|bank account|sort code|tax refund|irs|microsoft support|warranty expired|crypto wallet|bitcoin|wire transfer|social security)\b/i;

export const CALLER_SECURITY_LEVEL_LABELS: Record<CallerSecurityLevel, string> = {
  low: "Low",
  watch: "Watch",
  elevated: "Elevated",
  high: "High",
};

export const CALLER_SECURITY_RECOMMENDATION =
  "Consider blocking this caller from the call actions below.";

function maxLevel(a: CallerSecurityLevel, b: CallerSecurityLevel): CallerSecurityLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

function levelFromReasons(reasons: CallerSecurityReason[]): CallerSecurityLevel {
  return reasons.reduce<CallerSecurityLevel>(
    (current, reason) => maxLevel(current, reason.level),
    "low",
  );
}

function countCallsSince(
  calls: CallerSecurityCallInput[],
  sinceMs: number,
  nowMs: number,
): number {
  return calls.filter((call) => {
    const ts = new Date(call.createdAt).getTime();
    return Number.isFinite(ts) && ts >= sinceMs && ts <= nowMs;
  }).length;
}

function countOutcome(calls: CallerSecurityCallInput[], outcome: string): number {
  return calls.filter((call) => normalizeCallOutcome(call.outcome) === outcome).length;
}

function hasScamLanguage(calls: CallerSecurityCallInput[]): boolean {
  return calls.some((call) => SCAM_LANGUAGE_RE.test(String(call.aiSummary ?? "")));
}

function isRobocallPattern(calls: CallerSecurityCallInput[]): boolean {
  const sample = calls.slice(0, ROBocall_SAMPLE_SIZE);
  if (sample.length === 0) return false;
  const silent = countOutcome(sample, "voicemail_or_no_speech");
  return silent / sample.length >= ROBocall_MIN_RATIO;
}

function isTimeWasterPattern(
  calls: CallerSecurityCallInput[],
  openFollowUps: number,
  nowMs: number,
): boolean {
  if (openFollowUps > 0) return false;

  const sinceMs = nowMs - FREQUENT_CALLER_WINDOW_MS;
  const recent = calls.filter((call) => {
    const ts = new Date(call.createdAt).getTime();
    return Number.isFinite(ts) && ts >= sinceMs && ts <= nowMs;
  });
  if (recent.length < TIME_WASTER_MIN_CALLS) return false;

  const totalSeconds = recent.reduce(
    (sum, call) => sum + Math.max(0, call.durationSeconds),
    0,
  );
  const avgSeconds = totalSeconds / recent.length;
  return avgSeconds < TIME_WASTER_MAX_AVG_SECONDS;
}

export function assessCallerSecurityLevel(
  input: CallerSecurityAssessmentInput,
): CallerSecurityAssessment {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const reasons: CallerSecurityReason[] = [];

  if (input.isBlocked) {
    reasons.push({
      code: "blocked",
      label: "This number is blocked",
      level: "high",
    });
  }

  if (input.abuseHitCount >= 2) {
    reasons.push({
      code: "abuse_repeat",
      label: "Repeated abuse reports on file",
      level: "high",
    });
  } else if (input.abuseHitCount >= 1) {
    reasons.push({
      code: "abuse_signal",
      label: "Abuse report on file",
      level: "elevated",
    });
  }

  const spamCount = countOutcome(input.calls, "spam_or_abuse");
  if (spamCount >= 2) {
    reasons.push({
      code: "spam_repeat",
      label: "Multiple spam or abuse calls",
      level: "high",
    });
  } else if (spamCount >= 1) {
    reasons.push({
      code: "spam_or_abuse",
      label: "Spam or abuse call detected",
      level: "elevated",
    });
  }

  if (hasScamLanguage(input.calls)) {
    reasons.push({
      code: "scam_language",
      label: "Scam-style language in call summaries",
      level: "elevated",
    });
  }

  if (isRobocallPattern(input.calls)) {
    reasons.push({
      code: "possible_robocall",
      label: "Many silent or no-speech calls — possible robocall",
      level: "elevated",
    });
  }

  const timeWaster = isTimeWasterPattern(input.calls, input.openFollowUps, nowMs);
  const highVolumeToday =
    input.securityFlags.includes("high_volume_today") ||
    countCallsSince(input.calls, nowMs - HIGH_VOLUME_WINDOW_MS, nowMs) >= 3;

  if (timeWaster) {
    reasons.push({
      code: "possible_time_waster",
      label: "Many very short calls with no follow-ups",
      level: highVolumeToday ? "elevated" : "watch",
    });
  }

  if (input.securityFlags.includes("frequent_caller")) {
    reasons.push({
      code: "frequent_caller",
      label: "Frequent caller over the past week",
      level: "watch",
    });
  }

  if (input.securityFlags.includes("high_volume_today")) {
    reasons.push({
      code: "high_volume_today",
      label: "High call volume in the last 24 hours",
      level: "watch",
    });
  }

  if (input.securityFlags.includes("multiple_names")) {
    reasons.push({
      code: "multiple_names",
      label: "Multiple different names used",
      level: "watch",
    });
  }

  if (input.securityFlags.includes("open_complaints")) {
    reasons.push({
      code: "open_complaints",
      label: "Open complaint tickets linked to this number",
      level: "watch",
    });
  }

  const level = levelFromReasons(reasons);
  const recommendation =
    level === "elevated" || level === "high" ? CALLER_SECURITY_RECOMMENDATION : null;

  return {
    level,
    reasons,
    recommendation,
  };
}

export function callerSecurityOverviewPrefix(assessment: CallerSecurityAssessment): string | null {
  if (assessment.level === "low" || assessment.reasons.length === 0) return null;

  const label = CALLER_SECURITY_LEVEL_LABELS[assessment.level].toLowerCase();
  const topReason = assessment.reasons.sort(
    (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level],
  )[0];

  if (!topReason) return null;
  return `Cara rates this caller as ${label} risk — ${topReason.label.toLowerCase()}.`;
}
