import Link from "next/link";

import { cn } from "@/lib/utils";

export type DashboardStatStripItem = {
  label: string;
  value: string;
  href?: string;
};

/**
 * Home metrics row — numbers-first. Render inside a card, not as bare page chrome.
 */
export function DashboardStatStrip({
  stats,
  compact = false,
  className,
}: {
  stats: DashboardStatStripItem[];
  /** Tighter row for viewport-fit home board. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label="Key metrics"
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        compact
          ? "gap-y-4 sm:grid-cols-3 lg:gap-y-0 lg:divide-x lg:divide-slate-100"
          : "gap-x-4 gap-y-5 sm:gap-x-6",
        className,
      )}
    >
      {stats.map((stat) => {
        const inner = (
          <>
            <p
              className={cn(
                "font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums",
                compact
                  ? "text-[24px]"
                  : "text-[26px] sm:text-[30px]",
              )}
            >
              {stat.value}
            </p>
            <p
              className={cn(
                "leading-snug text-slate-500",
                compact ? "mt-1 text-[12px]" : "mt-1.5 text-[13px]",
              )}
            >
              {stat.label}
            </p>
          </>
        );

        if (stat.href) {
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group block rounded-lg px-1 py-1 outline-none transition-colors hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-[#0b1220]/20 lg:px-5 lg:first:pl-1"
            >
              {inner}
            </Link>
          );
        }

        return (
          <div key={stat.label} className="min-w-0 px-1 py-1 lg:px-5 lg:first:pl-1">
            {inner}
          </div>
        );
      })}
    </section>
  );
}
