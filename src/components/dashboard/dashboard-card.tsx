import type { ReactNode } from "react";

import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_PREVIEW_CARD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type DashboardCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** `home` — same card chrome as `/dashboard` panels. */
  surface?: "default" | "home";
};

export function DashboardCard({
  title,
  action,
  children,
  className,
  bodyClassName,
  surface = "default",
}: DashboardCardProps) {
  const isHome = surface === "home";

  return (
    <section
      className={cn(
        isHome ? DASHBOARD_HOME_PREVIEW_CARD : DASHBOARD_CARD_SURFACE,
        "flex min-h-0 flex-col overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2",
          isHome ? "mb-2.5" : "border-b border-slate-100 px-5 py-4",
        )}
      >
        <h2
          className={cn(
            "font-semibold tracking-tight text-[#0b1220]",
            isHome ? "text-[15px]" : "text-[15px]",
          )}
        >
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
