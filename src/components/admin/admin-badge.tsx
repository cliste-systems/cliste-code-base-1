import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Neutral admin pill for status-like values. */
export const adminBadgeClass =
  "inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700";

/** Plain label — no pill box, easier to scan in dense tables. */
export const adminTableLabelClass = "text-sm font-medium text-gray-800";

/** Secondary table text (niche, metadata). */
export const adminTableMutedClass = "text-sm text-gray-500";

type AdminBadgeProps = {
  children: ReactNode;
  className?: string;
  /** plain = text only; badge = outlined pill (default). */
  variant?: "badge" | "plain";
};

export function AdminBadge({
  children,
  className,
  variant = "badge",
}: AdminBadgeProps) {
  if (variant === "plain") {
    return (
      <span className={cn(adminTableLabelClass, className)}>{children}</span>
    );
  }

  return <span className={cn(adminBadgeClass, className)}>{children}</span>;
}
