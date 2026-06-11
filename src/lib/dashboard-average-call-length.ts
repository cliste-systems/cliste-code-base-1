import { formatDurationLabel } from "@/lib/call-history-types";

export type AverageCallLength = {
  averageSeconds: number | null;
  callCount: number;
};

/** Mean duration for calls in the selected period (null when there are no calls). */
export function computeAverageCallLength(
  durationSeconds: (number | null | undefined)[],
): AverageCallLength {
  const measured = durationSeconds.filter(
    (d): d is number => typeof d === "number" && Number.isFinite(d) && d >= 0,
  );
  if (measured.length === 0) {
    return { averageSeconds: null, callCount: 0 };
  }
  const sum = measured.reduce((acc, s) => acc + s, 0);
  return {
    averageSeconds: Math.round(sum / measured.length),
    callCount: measured.length,
  };
}

export function formatAverageCallLengthValue(
  averageSeconds: number | null,
): string {
  if (averageSeconds === null) return "—";
  return formatDurationLabel(averageSeconds);
}

export function formatAverageCallLengthSubtext(
  callCount: number,
  periodPhrase: string,
): string {
  if (callCount === 0) {
    return periodPhrase === "today"
      ? "No calls today"
      : `No calls ${periodPhrase}`;
  }
  if (callCount === 1) return `${periodPhrase} · 1 call`;
  return `${periodPhrase} · ${callCount} calls`;
}
