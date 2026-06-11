"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";
import { cn } from "@/lib/utils";

const OPTIONS: { value: DashboardMetricRangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "4w", label: "30 days" },
];

type DashboardMetricRangeToggleProps = {
  /** Hero panel: lighter pill on silver gradient background. */
  variant?: "default" | "hero";
};

export function DashboardMetricRangeToggle({
  variant = "default",
}: DashboardMetricRangeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("range");
  const current: DashboardMetricRangeKey =
    raw === "7d" || raw === "4w" || raw === "30d"
      ? raw === "30d"
        ? "4w"
        : raw
      : "today";

  function setRange(next: DashboardMetricRangeKey) {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "today") {
      q.delete("range");
    } else {
      q.set("range", next);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "no-scrollbar inline-flex max-w-full items-center overflow-x-auto rounded-full border backdrop-blur",
        isHero
          ? "gap-0 border-white/60 bg-white/70 p-0.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
          : "gap-0.5 border-[#e5eaf2] bg-white/70 p-1 shadow-[0_8px_30px_rgba(15,23,42,0.04)]",
      )}
      role="group"
      aria-label="Metrics time range"
    >
      {OPTIONS.map(({ value, label }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setRange(value)}
            className={cn(
              "shrink-0 rounded-full font-medium whitespace-nowrap transition-colors",
              isHero
                ? "h-9 px-3.5 text-[12px]"
                : "h-[42px] px-4 text-[13px]",
              active
                ? "bg-[#0b1220] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(15,23,42,0.12)]"
                : isHero
                  ? "text-slate-600 hover:bg-white/80 hover:text-[#0b1220]"
                  : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
