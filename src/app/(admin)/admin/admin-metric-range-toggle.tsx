"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AdminGlobalMetricPeriod } from "@/lib/admin-metric-range";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AdminGlobalMetricPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export function AdminMetricRangeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("period");
  const current: AdminGlobalMetricPeriod =
    raw === "week" || raw === "month" ? raw : "day";

  function setPeriod(next: AdminGlobalMetricPeriod) {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "day") {
      q.delete("period");
    } else {
      q.set("period", next);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-full border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
      role="group"
      aria-label="Global metrics time range"
    >
      {OPTIONS.map(({ value, label }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
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
