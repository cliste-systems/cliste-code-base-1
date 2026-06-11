import type { ReactNode } from "react";

import { DASHBOARD_SECTION_TITLE_CLASS } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

/** Section title inside the home workspace board. */
export function DashboardHomeBoardSection({
  title,
  action,
  children,
  className,
  compact = false,
  /** When false, content keeps natural height (avoids stretching empty panels). */
  grow = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  grow?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", grow && "min-h-0 flex-1", className)}>
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          compact ? "mb-1.5" : "mb-4",
        )}
      >
        <h2
          className={cn(
            DASHBOARD_SECTION_TITLE_CLASS,
            compact && "text-[14px]",
          )}
        >
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn(grow ? "min-h-0 flex-1" : "min-w-0")}>{children}</div>
    </div>
  );
}
