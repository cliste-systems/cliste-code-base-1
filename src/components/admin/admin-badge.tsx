import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Neutral admin pill — use everywhere instead of per-status color chips. */
export const adminBadgeClass =
  "inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600";

export function AdminBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(adminBadgeClass, className)}>{children}</span>;
}
