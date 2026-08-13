"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const REVEAL_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const REVEAL_MS = "duration-200";

type HoursTimeRevealProps = {
  open: boolean;
  children: ReactNode;
  closedLabel?: string;
  className?: string;
};

/**
 * Crossfade between closed label and time inputs inside a fixed-height slot
 * so the parent row does not jump or glitch while toggling.
 */
export function HoursTimeReveal({
  open,
  children,
  closedLabel = "Closed",
  className,
}: HoursTimeRevealProps) {
  return (
    <div className={cn("relative h-9 min-w-0 flex-1", className)}>
      <div
        className={cn(
          "absolute inset-0 flex min-w-0 items-center gap-1.5 motion-reduce:transition-none",
          REVEAL_MS,
          "transition-opacity ease-out",
          open
            ? "z-10 opacity-100"
            : "pointer-events-none z-0 opacity-0",
        )}
        aria-hidden={!open}
      >
        {children}
      </div>
      <div
        className={cn(
          "absolute inset-0 flex items-center motion-reduce:transition-none",
          REVEAL_MS,
          "transition-opacity ease-out",
          open
            ? "pointer-events-none z-0 opacity-0"
            : "z-10 opacity-100",
        )}
        aria-hidden={open}
      >
        <span className="text-[13px] text-slate-400">{closedLabel}</span>
      </div>
    </div>
  );
}

type HoursPanelRevealProps = {
  show: boolean;
  children: ReactNode;
  className?: string;
  /** Must exceed the panel content height to avoid clipping. */
  maxHeightClass?: string;
};

/** Smooth reveal for single-line panels below a tab row. */
export function HoursPanelReveal({
  show,
  children,
  className,
  maxHeightClass = "max-h-12",
}: HoursPanelRevealProps) {
  return (
    <div
      className={cn(
        "overflow-hidden motion-reduce:transition-none",
        REVEAL_MS,
        "transition-[max-height,opacity]",
        show ? cn(maxHeightClass, "opacity-100") : "max-h-0 opacity-0",
        className,
      )}
      style={{ transitionTimingFunction: REVEAL_EASE }}
      aria-hidden={!show}
    >
      {children}
    </div>
  );
}
