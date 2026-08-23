import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  muted?: boolean;
  className?: string;
};

export function AdminStatCard({
  label,
  value,
  muted,
  className,
}: AdminStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight",
          muted ? "text-gray-500" : "text-gray-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}
