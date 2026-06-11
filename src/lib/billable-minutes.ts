/** Matches `usage_records.minutes_billable` numeric(7,2). */
export const BILLABLE_MINUTES_DECIMALS = 2;

/**
 * Billable minutes for a single call — actual talk time, not rounded up.
 * Matches voice worker `finishUsageRecord` and Stripe meter aggregation.
 */
export function billableMinutesFromDurationSeconds(
  durationSeconds: number,
): number {
  const seconds = Math.max(0, durationSeconds);
  const factor = 10 ** BILLABLE_MINUTES_DECIMALS;
  return Math.round((seconds / 60) * factor) / factor;
}

export function sumBillableMinutesFromDurations(
  durationsSeconds: Iterable<number | null | undefined>,
): number {
  let total = 0;
  for (const raw of durationsSeconds) {
    total += billableMinutesFromDurationSeconds(raw ?? 0);
  }
  return total;
}
