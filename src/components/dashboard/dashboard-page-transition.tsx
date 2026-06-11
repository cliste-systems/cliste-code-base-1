"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { onboardingPageVariants } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

type DashboardPageTransitionProps = {
  children: React.ReactNode;
  animateKey: string;
  className?: string;
};

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
    <AnimatePresence mode="wait">
      <motion.div
        key={animateKey}
        variants={onboardingPageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn("w-full min-w-0", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
