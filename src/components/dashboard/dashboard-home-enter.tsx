"use client";

import { motion, useReducedMotion } from "motion/react";

import { useOnboardingAnimateIn } from "@/components/onboarding/onboarding-enter";
import { onboardingPageVariants } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

/**
 * One-shot home fade — single wrapper so flex-1 / min-h-0 on workspace panels stay intact.
 */
export function DashboardHomeEnter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ready = useOnboardingAnimateIn();

  if (reduceMotion) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}
      variants={onboardingPageVariants}
      initial="initial"
      animate={ready ? "animate" : "initial"}
    >
      {children}
    </motion.div>
  );
}
