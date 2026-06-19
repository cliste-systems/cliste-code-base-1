import { normalizeCallOutcome } from "@/lib/call-history-types";
import {
  computeAverageCallLength,
  formatAverageCallLengthValue,
} from "@/lib/dashboard-average-call-length";
import type { AnalyticsSegment } from "@/lib/dashboard-home-analytics";

const UNHAPPY_PATTERN =
  /\b(complaint|unhappy|refund|disappointed|upset|angry|terrible|rude)\b/i;

const NEGATIVE_OUTCOMES = new Set([
  "spam_or_abuse",
  "voicemail_or_no_speech",
  "failed",
  "blocked",
]);

const QUALITY_SHADES = ["#0b1220", "#cbd5e1"] as const;

export type HomeCaraPerformanceSnapshot = {
  isOnline: boolean;
  statusLabel: string;
  qualitySegments: AnalyticsSegment[];
  avgDurationLabel: string;
  totalCalls: number;
};

export type HomeCaraPerformanceCallRow = {
  outcome: string;
  duration_seconds: number | null;
  ai_summary: string | null;
};

function isHappyCall(outcome: string, summary: string | null): boolean {
  if (UNHAPPY_PATTERN.test(String(summary ?? ""))) return false;
  const normalized = normalizeCallOutcome(outcome);
  return !NEGATIVE_OUTCOMES.has(normalized);
}

function buildQualitySegments(
  happyCount: number,
  needsReviewCount: number,
): AnalyticsSegment[] {
  const total = happyCount + needsReviewCount;
  const toPercent = (value: number) =>
    total > 0 ? Math.round((value / total) * 100) : 0;

  return [
    {
      id: "happy",
      label: "Happy calls",
      value: happyCount,
      percent: toPercent(happyCount),
      shade: QUALITY_SHADES[0],
    },
    {
      id: "needs-review",
      label: "Needs review",
      value: needsReviewCount,
      percent: toPercent(needsReviewCount),
      shade: QUALITY_SHADES[1],
    },
  ];
}

export function buildHomeCaraPerformance(input: {
  isOnline: boolean;
  statusLabel: string;
  calls: HomeCaraPerformanceCallRow[];
}): HomeCaraPerformanceSnapshot {
  const totalCalls = input.calls.length;
  const happyCount = input.calls.filter((call) =>
    isHappyCall(call.outcome, call.ai_summary),
  ).length;
  const needsReviewCount = Math.max(0, totalCalls - happyCount);

  const avgLength = computeAverageCallLength(
    input.calls.map((call) => call.duration_seconds),
  );

  return {
    isOnline: input.isOnline,
    statusLabel: input.statusLabel,
    qualitySegments: buildQualitySegments(happyCount, needsReviewCount),
    avgDurationLabel: formatAverageCallLengthValue(avgLength.averageSeconds),
    totalCalls,
  };
}
