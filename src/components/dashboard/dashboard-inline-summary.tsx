import { cn } from "@/lib/utils";

export type InlineSummarySegment = {
  label: string;
  value: string;
};

type DashboardInlineSummaryProps = {
  segments: InlineSummarySegment[];
  className?: string;
};

/** Quiet one-line summary for sub-pages (not full metric cards). */
export function DashboardInlineSummary({
  segments,
  className,
}: DashboardInlineSummaryProps) {
  if (segments.length === 0) return null;

  return (
    <p
      className={cn(
        "text-[13px] leading-relaxed text-slate-600 tabular-nums",
        className,
      )}
      aria-label="Page summary"
    >
      {segments.map((seg, i) => (
        <span key={seg.label}>
          {i > 0 ? (
            <span className="mx-2 text-slate-300" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="font-medium text-[#0b1220]">{seg.value}</span>{" "}
          <span className="text-slate-500">{seg.label}</span>
        </span>
      ))}
    </p>
  );
}
