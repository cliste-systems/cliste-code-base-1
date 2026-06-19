export type HomeCallTimesBucket = {
  id: string;
  label: string;
  value: number;
};

/** Home card shows a bar chart once calls span enough hours or volume. */
export const HOME_CALL_TIMES_MIN_CALLS_FOR_CHART = 5;
export const HOME_CALL_TIMES_MIN_ACTIVE_HOURS_FOR_CHART = 2;

const HOME_CALL_TIMES_CHART_START_HOUR = 8;
const HOME_CALL_TIMES_CHART_END_HOUR = 18;

export function buildHomeCallTimesBuckets(
  timestamps: string[],
): HomeCallTimesBucket[] {
  const counts = new Map<number, number>();

  for (const iso of timestamps) {
    const hour = new Date(iso).getHours();
    if (Number.isNaN(hour)) continue;
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  if (counts.size === 0) return [];

  const sortedHours = [...counts.keys()].sort((a, b) => a - b);
  const dataStart = sortedHours[0]!;
  const dataEnd = sortedHours[sortedHours.length - 1]!;
  const start = Math.min(HOME_CALL_TIMES_CHART_START_HOUR, dataStart);
  const end = Math.max(HOME_CALL_TIMES_CHART_END_HOUR, dataEnd);

  const buckets: HomeCallTimesBucket[] = [];
  for (let hour = start; hour <= end; hour += 1) {
    buckets.push({
      id: `hour-${hour}`,
      label: formatHourLabel(hour),
      value: counts.get(hour) ?? 0,
    });
  }

  return buckets;
}

export function homeCallTimesTotal(buckets: HomeCallTimesBucket[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.value, 0);
}

export function homeCallTimesActiveHourCount(buckets: HomeCallTimesBucket[]): number {
  return buckets.filter((bucket) => bucket.value > 0).length;
}

export function homeCallTimesReadyForChart(buckets: HomeCallTimesBucket[]): boolean {
  const total = homeCallTimesTotal(buckets);
  if (total <= 0) return false;
  if (total >= HOME_CALL_TIMES_MIN_CALLS_FOR_CHART) return true;
  return homeCallTimesActiveHourCount(buckets) >= HOME_CALL_TIMES_MIN_ACTIVE_HOURS_FOR_CHART;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export function homeCallTimesPeakLabel(buckets: HomeCallTimesBucket[]): string | null {
  if (buckets.length === 0) return null;
  const peak = buckets.reduce((best, bucket) =>
    bucket.value > best.value ? bucket : best,
  );
  if (peak.value <= 0) return null;
  return peak.label;
}
