"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";
import { cn } from "@/lib/utils";

const OPTIONS: { value: DashboardMetricRangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7 days" },
  { value: "4w", label: "30 days" },
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
      className="no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[#e2e8f0] bg-white p-1 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
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
              "h-[42px] shrink-0 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-[#3f4451] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(15,23,42,0.12)]"
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
