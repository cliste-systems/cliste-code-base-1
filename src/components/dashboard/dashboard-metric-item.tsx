import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function MetricItem({
  icon: Icon,
  label,
  value,
  href,
  title,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  title?: string;
  valueClassName?: string;
}) {
  const content = (
    <>
      <Icon className="mb-1.5 size-3.5 text-slate-400" aria-hidden />
      <p className="truncate text-[11px] text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-medium text-slate-700",
          valueClassName ?? "truncate text-[13px]",
        )}
      >
        {value}
      </p>
    </>
  );

  const className =
    "flex min-w-0 flex-col items-center justify-center px-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 rounded-sm";

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        className={cn(className, "transition-colors hover:bg-slate-50/80")}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className} title={title}>
      {content}
    </div>
  );
}
