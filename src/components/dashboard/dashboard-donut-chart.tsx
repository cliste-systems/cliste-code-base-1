import { cn } from "@/lib/utils";

import type { AnalyticsSegment } from "@/lib/dashboard-home-analytics";

function conicGradient(segments: AnalyticsSegment[]): string {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return "conic-gradient(#e2e8f0 0deg 360deg)";
  }

  let cursor = 0;
  const stops: string[] = [];

  for (const segment of segments) {
    if (segment.value <= 0) continue;
    const sweep = (segment.value / total) * 360;
    const end = cursor + sweep;
    stops.push(`${segment.shade} ${cursor}deg ${end}deg`);
    cursor = end;
  }

  if (stops.length === 0) {
    return "conic-gradient(#e2e8f0 0deg 360deg)";
  }

  return `conic-gradient(${stops.join(", ")})`;
}

export function DashboardDonutChart({
  segments,
  className,
  size = 76,
}: {
  segments: AnalyticsSegment[];
  className?: string;
  size?: number;
}) {
  const hole = Math.round(size * 0.58);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="size-full rounded-full"
        style={{ background: conicGradient(segments) }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{ width: hole, height: hole }}
      />
    </div>
  );
}

export function DashboardAnalyticsLegend({
  segments,
  className,
}: {
  segments: AnalyticsSegment[];
  className?: string;
}) {
  return (
    <ul className={cn("min-w-0 flex-1 space-y-2", className)}>
      {segments.map((segment) => (
        <li
          key={segment.id}
          className="flex items-center justify-between gap-3 text-[12px]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: segment.shade }}
              aria-hidden
            />
            <span className="truncate text-slate-600">{segment.label}</span>
          </span>
          <span className="shrink-0 tabular-nums text-slate-500">
            {segment.value}
            {segment.percent > 0 ? ` (${segment.percent}%)` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
