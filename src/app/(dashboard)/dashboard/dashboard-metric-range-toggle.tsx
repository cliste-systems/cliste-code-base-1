"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";
import { cn } from "@/lib/utils";

const OPTIONS: { value: DashboardMetricRangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "4w", label: "Last 4 weeks" },
];

export function DashboardMetricRangeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("range");
  const current: DashboardMetricRangeKey =
    raw === "yesterday" || raw === "7d" || raw === "4w" ? raw : "today";

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

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-full border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
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
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
