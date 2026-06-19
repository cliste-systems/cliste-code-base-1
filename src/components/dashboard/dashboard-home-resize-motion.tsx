"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";

/** Smooth reflow when the home board grows or shrinks (e.g. window maximize). */
export const dashboardHomeLayoutTransition = {
  layout: {
    type: "spring" as const,
    stiffness: 320,
    damping: 36,
    mass: 0.85,
  },
  default: {
    duration: 0.42,
    ease: ONBOARDING_EASE,
  },
};

export function DashboardHomeResizeItem({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      layout
      transition={dashboardHomeLayoutTransition}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
