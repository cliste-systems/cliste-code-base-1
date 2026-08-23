import type { ReactNode } from "react";

import { adminSetupStatusBadgeClass } from "@/lib/admin-client-setup-status";
import { cn } from "@/lib/utils";

export function AdminSetupStatusBadge({
  isLive,
  children,
  className,
}: {
  isLive: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        adminSetupStatusBadgeClass(isLive),
        className,
      )}
    >
      {children}
    </span>
  );
}
