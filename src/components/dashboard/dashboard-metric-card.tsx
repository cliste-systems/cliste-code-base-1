import type { ComponentType } from "react";
import Link from "next/link";

import {
  DASHBOARD_CARD_INTERACTIVE,
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_LABEL_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type DashboardMetricCardProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  value: string;
  label: string;
  href?: string;
  compact?: boolean;
};

export function DashboardMetricCard({
  icon: Icon,
  value,
  label,
  href,
  compact = false,
}: DashboardMetricCardProps) {
  const body = (
    <div
      className={cn(
        DASHBOARD_CARD_SURFACE,
        href && DASHBOARD_CARD_INTERACTIVE,
        "flex flex-col justify-between",
        compact ? "h-[100px] p-4" : "h-[120px] p-5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            DASHBOARD_LABEL_CLASS,
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
        >
          <Icon className={compact ? "size-4" : "size-[17px]"} aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          "font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums",
          compact ? "text-[24px]" : "text-[28px]",
        )}
      >
        {value}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}
