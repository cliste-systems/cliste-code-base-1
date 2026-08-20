"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AdminGlobalMetricPeriod } from "@/lib/admin-metric-range";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AdminGlobalMetricPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export function AdminMetricRangeToggle({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("period");
  const current: AdminGlobalMetricPeriod =
    raw === "week" || raw === "month" ? raw : "day";
  const isDark = variant === "dark";

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
      className={cn(
        "inline-flex items-center gap-1 rounded-full p-1",
        isDark
          ? "border border-white/15 bg-white/10"
          : "border border-slate-200/80 bg-white shadow-sm",
      )}
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
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              isDark
                ? active
                  ? "bg-white text-[#0b1220] shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
                : active
                  ? "bg-[#0b1220] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[#0b1220]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
