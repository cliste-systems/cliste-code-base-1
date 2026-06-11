import { normalizeCallOutcome, type CallOutcome } from "@/lib/call-history-types";

const INELIGIBLE: readonly CallOutcome[] = [
  "spam_or_abuse",
  "voicemail_or_no_speech",
];

const SUCCESS: readonly CallOutcome[] = [
  "answered",
  "link_sent",
  "callback_requested",
  "action_created",
];

export type CallSuccessRate = {
  percent: number | null;
  eligibleCount: number;
};

/** Share of eligible calls with a useful outcome (excludes spam/voicemail). */
export function computeCallSuccessRate(
  rawOutcomes: string[],
): CallSuccessRate {
  const normalized = rawOutcomes.map((o) => normalizeCallOutcome(o));
  const eligible = normalized.filter((o) => !INELIGIBLE.includes(o));
  if (eligible.length === 0) {
    return { percent: null, eligibleCount: 0 };
  }

  const successCount = eligible.filter((o) => SUCCESS.includes(o)).length;
  return {
    percent: Math.round((successCount / eligible.length) * 100),
    eligibleCount: eligible.length,
  };
}

export function formatCallSuccessRateValue(percent: number | null): string {
  if (percent === null) return "—";
  return `${percent}%`;
}

export function formatCallSuccessRateSubtext(
  eligibleCount: number,
  periodPhrase: string,
): string {
  if (eligibleCount === 0) {
    return periodPhrase === "today"
      ? "No calls today"
      : `No calls ${periodPhrase}`;
  }
  if (eligibleCount === 1) return `${periodPhrase} · 1 call`;
  return `${periodPhrase} · ${eligibleCount} calls`;
}
