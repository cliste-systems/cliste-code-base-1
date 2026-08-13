"use client";

import { motion, useReducedMotion } from "motion/react";

import { onboardingPageTransition } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

type DashboardPageTransitionProps = {
  children: React.ReactNode;
  animateKey: string;
  className?: string;
};

/** Soft enter when switching dashboard sections — no exit animation (avoids DOM teardown races). */
export function DashboardPageTransition({
  children,
  animateKey,
  className,
}: DashboardPageTransitionProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={cn("w-full min-w-0", className)}>{children}</div>;
  }

  return (
    <motion.div
      key={animateKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={onboardingPageTransition}
      className={cn("w-full min-w-0", className)}
    >
      {children}
    </motion.div>
  );
}
