import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function AdminStatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = "default",
  action,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string | null;
  icon: ReactNode;
  href?: string;
  tone?: "default" | "urgent";
  action?: ReactNode;
  className?: string;
}) {
  const urgent = tone === "urgent";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border",
            urgent
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-slate-200/90 bg-white text-slate-500",
          )}
        >
          {icon}
        </span>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4 min-w-0">
        <p
          className={cn(
            "text-[26px] font-semibold leading-none tracking-tight tabular-nums",
            urgent ? "text-red-700" : "text-[#0b1220]",
          )}
        >
          {value}
        </p>
        <p
          className={cn(
            "mt-1.5 text-[13px] font-medium",
            urgent ? "text-red-800/90" : "text-slate-600",
          )}
        >
          {label}
        </p>
        {hint ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>
        ) : null}
      </div>
    </>
  );

  const cardClassName = cn(
    "flex h-full flex-col rounded-xl border bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-18px_rgba(15,23,42,0.18)] transition-colors",
    urgent
      ? "border-red-300/80 bg-red-50/40 ring-1 ring-red-200/60"
      : "border-slate-200/80 hover:border-slate-300/80",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(cardClassName, "group outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40")}>
        {inner}
      </Link>
    );
  }

  return <div className={cardClassName}>{inner}</div>;
}
