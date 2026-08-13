import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  Inbox,
  Phone,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type DashboardStatStripItem = {
  label: string;
  value: string;
  href?: string;
  icon?: LucideIcon;
};

const DEFAULT_STAT_ICONS: Record<string, LucideIcon> = {
  "Calls answered": Phone,
  "Enquiries captured": Inbox,
  "Info sent": ArrowUpRight,
  "Follow-ups due": Clock3,
  "Needs attention": AlertCircle,
  "Minutes this period": Timer,
};

/**
 * Home metrics row — numbers-first. Render inside a card or hero glass strip.
 */
export function DashboardStatStrip({
  stats,
  compact = false,
  variant = "default",
  className,
}: {
  stats: DashboardStatStripItem[];
  /** Tighter row for viewport-fit home board. */
  compact?: boolean;
  variant?: "default" | "heroGlass";
  className?: string;
}) {
  const isHeroGlass = variant === "heroGlass";

  return (
    <section
      aria-label="Key metrics"
      className={cn(
        isHeroGlass
          ? "grid grid-cols-2 divide-y divide-slate-200/70 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x lg:divide-y-0"
          : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        !isHeroGlass &&
          (compact
            ? "gap-y-4 sm:grid-cols-3 lg:gap-y-0 lg:divide-x lg:divide-slate-100"
            : "gap-x-4 gap-y-5 sm:gap-x-6"),
        className,
      )}
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon ?? DEFAULT_STAT_ICONS[stat.label] ?? AlertCircle;
        const showHeroDivider =
          isHeroGlass && index > 0 && index % 2 === 0 ? "sm:max-lg:border-l-0" : "";

        const inner = (
          <>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white/90 text-slate-500">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums",
                    isHeroGlass
                      ? "text-[22px] sm:text-[24px]"
                      : compact
                        ? "text-[24px]"
                        : "text-[26px] sm:text-[30px]",
                  )}
                >
                  {stat.value}
                </p>
                <p
                  className={cn(
                    "leading-snug text-slate-500",
                    isHeroGlass
                      ? "mt-1 text-[11px] sm:text-[12px]"
                      : compact
                        ? "mt-1 text-[12px]"
                        : "mt-1.5 text-[13px]",
                  )}
                >
                  {stat.label}
                </p>
              </div>
            </div>
          </>
        );

        const itemClassName = cn(
          "min-w-0 px-2 py-2 sm:px-3 lg:px-4 lg:first:pl-2",
          isHeroGlass && "lg:py-1",
          showHeroDivider,
        );

        if (stat.href) {
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className={cn(
                itemClassName,
                "group block rounded-lg outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[#0b1220]/20",
              )}
            >
              {inner}
            </Link>
          );
        }

        return (
          <div key={stat.label} className={itemClassName}>
            {inner}
          </div>
        );
      })}
    </section>
  );
}
