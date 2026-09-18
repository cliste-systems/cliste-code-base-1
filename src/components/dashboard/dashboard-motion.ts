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

/** Stagger child entrances inside lists, grids, and stacked panels. */
export const dashboardStaggerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

/** Opacity-only swap for nested dashboard panels (avoids layout jump from y-offset). */
export const dashboardPanelFadeTransition: Transition = {
  duration: 0.2,
  ease: ONBOARDING_EASE,
};
