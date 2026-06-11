import type { Transition, Variants } from "motion/react";

import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";

/** Snappy enter for list rows, thread bubbles, and inline panels. */
export const dashboardQuickEnterTransition: Transition = {
  duration: 0.36,
  ease: ONBOARDING_EASE,
};

export const dashboardQuickEnterVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: dashboardQuickEnterTransition,
  },
};
