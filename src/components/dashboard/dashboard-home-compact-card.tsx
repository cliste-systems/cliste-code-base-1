import type { CSSProperties, ReactNode, RefObject } from "react";

import {
  DASHBOARD_HOME_ATTENTION_CARD,
  DASHBOARD_HOME_CARA_STATUS_CARD,
  DASHBOARD_HOME_PREVIEW_CARD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export function DashboardHomeCompactCard({
  title,
  action,
  children,
  bodyClassName,
  bodyStyle,
  bodyRef,
  /** Lay the body out as a flex column (used when the body height is measured). */
  fillBody = false,
  className,
  tone = "default",
  density = "default",
  /** Cara status: no header margin; body carries equal vertical inset around metrics. */
  balancedMetrics = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
  bodyRef?: RefObject<HTMLDivElement | null>;
  fillBody?: boolean;
  className?: string;
  /** `attention` tints the whole section in Cliste ink. */
  tone?: "default" | "attention";
  /** `compact` — tighter header and padding (Cara status). */
  density?: "default" | "compact";
  balancedMetrics?: boolean;
}) {
  const isAttention = tone === "attention";
  const isCompact = density === "compact";

  return (
    <section
      className={cn(
        isAttention
          ? DASHBOARD_HOME_ATTENTION_CARD
          : isCompact
            ? DASHBOARD_HOME_CARA_STATUS_CARD
            : DASHBOARD_HOME_PREVIEW_CARD,
        "flex min-h-0 flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2",
          balancedMetrics
            ? "mb-0 border-b border-slate-100 pb-2.5 pt-2.5 sm:pb-3 sm:pt-3"
            : isCompact
              ? "mb-2"
              : "mb-2.5",
        )}
      >
        <h2
          className={cn(
            "font-semibold tracking-tight text-[#0b1220]",
            isCompact ? "text-[14px]" : "text-[15px]",
          )}
        >
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div
        ref={bodyRef}
        className={cn("min-h-0", fillBody && "flex flex-col", bodyClassName)}
        style={bodyStyle}
      >
        {children}
      </div>
    </section>
  );
}
