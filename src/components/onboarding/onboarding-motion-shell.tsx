"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { onboardingPageVariants } from "./onboarding-motion";

type Props = {
  children: ReactNode;
};

export function OnboardingMotionShell({ children }: Props) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={onboardingPageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
