"use client";

import { motion, useReducedMotion } from "motion/react";

import { dashboardPanelFadeTransition } from "@/components/dashboard/dashboard-motion";
import { cn } from "@/lib/utils";

type CaraKnowledgeSectionTransitionProps = {
  animateKey: string;
  children: React.ReactNode;
  className?: string;
};

/** Soft fade for folder drill and search — no slide, to avoid scroll/layout glitches. */
export function CaraKnowledgeSectionTransition({
  animateKey,
  children,
  className,
}: CaraKnowledgeSectionTransitionProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={animateKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={dashboardPanelFadeTransition}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
    >
      {children}
    </motion.div>
  );
}
