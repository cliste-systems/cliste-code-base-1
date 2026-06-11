"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { onboardingPageVariants } from "./onboarding-motion";

type Props = {
  stepKey: string;
  children: ReactNode;
  className?: string;
};

/** Fade/slide between steps inside a single onboarding page (e.g. Train Cara). */
export function OnboardingStepPanel({ stepKey, children, className }: Props) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        variants={onboardingPageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn("w-full", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
