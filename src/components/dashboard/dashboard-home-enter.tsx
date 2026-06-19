"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";

import { useOnboardingAnimateIn } from "@/components/onboarding/onboarding-enter";
import {
  dashboardHomeLayoutTransition,
} from "@/components/dashboard/dashboard-home-resize-motion";
import { onboardingPageVariants } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

/**
 * One-shot home fade — fixed viewport column on desktop (no page scroll).
 * LayoutGroup keeps cards and hero smooth when the window is resized.
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
      <div
        className={cn(
          "flex h-full min-h-0 flex-1 flex-col gap-4",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <LayoutGroup id="dashboard-home">
      <motion.div
        layout
        transition={dashboardHomeLayoutTransition}
        className={cn(
          "flex h-full min-h-0 flex-1 flex-col gap-4",
          className,
        )}
        variants={onboardingPageVariants}
        initial="initial"
        animate={ready ? "animate" : "initial"}
      >
        {children}
      </motion.div>
    </LayoutGroup>
  );
}
