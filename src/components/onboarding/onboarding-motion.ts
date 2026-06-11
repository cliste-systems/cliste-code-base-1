import type { Transition, Variants } from "motion/react";

export const ONBOARDING_EASE = [0.22, 1, 0.36, 1] as const;

/** Matches OnboardingCanvasBackground fade duration. */
export const ONBOARDING_BG_DURATION = 0.95;

export const ONBOARDING_ENTER_DELAY = 0.16;
export const ONBOARDING_STAGGER = 0.07;
export const ONBOARDING_ITEM_DURATION = 0.78;

export function onboardingItemTransition(index: number): Transition {
  return {
    delay: ONBOARDING_ENTER_DELAY + index * ONBOARDING_STAGGER,
    duration: ONBOARDING_ITEM_DURATION,
    ease: ONBOARDING_EASE,
  };
}

export const onboardingPageTransition: Transition = {
  duration: 0.52,
  ease: ONBOARDING_EASE,
};

export const onboardingSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
};

export const onboardingPageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: onboardingPageTransition,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.28, ease: ONBOARDING_EASE },
  },
};

/** Top-level onboarding column — syncs with background fade-in. */
export const onboardingShellVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: ONBOARDING_ENTER_DELAY,
      staggerChildren: ONBOARDING_STAGGER,
    },
  },
};

/** Stagger container for header copy, form fields, or panel blocks. */
export const onboardingGroupVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: ONBOARDING_STAGGER,
      delayChildren: 0.03,
    },
  },
};

/** Stagger-only container — children animate, wrapper stays visible. */
export const onboardingStaggerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: ONBOARDING_STAGGER,
      delayChildren: 0.03,
    },
  },
};

/** Single element entrance — soft rise matching the photo background. */
export const onboardingEnterItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: ONBOARDING_ITEM_DURATION, ease: ONBOARDING_EASE },
  },
};

export const onboardingLogoVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: ONBOARDING_BG_DURATION * 0.85, ease: ONBOARDING_EASE },
  },
};

export const onboardingHeadlineVariants = onboardingGroupVariants;

export const onboardingContentVariants = onboardingStaggerVariants;

export const onboardingFieldContainerVariants = onboardingStaggerVariants;

export const onboardingFieldItemVariants = onboardingEnterItemVariants;

export const onboardingFooterVariants = onboardingEnterItemVariants;

/** Profile hero — slower, softer rise with a touch of scale. */
export const ONBOARDING_PROFILE_ENTER_DELAY = 0.48;
export const ONBOARDING_PROFILE_STAGGER = 0.09;
export const ONBOARDING_PROFILE_ITEM_DURATION = 0.92;

export function onboardingProfileItemTransition(index: number): Transition {
  return {
    delay: ONBOARDING_PROFILE_ENTER_DELAY + index * ONBOARDING_PROFILE_STAGGER,
    duration: ONBOARDING_PROFILE_ITEM_DURATION,
    ease: ONBOARDING_EASE,
  };
}

export const onboardingProfileEnterItemVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.985, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: ONBOARDING_PROFILE_ITEM_DURATION,
      ease: ONBOARDING_EASE,
    },
  },
};

export const onboardingProfileKenBurns: Transition = {
  duration: 18,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "mirror",
};

/** Profile hero photo — cinematic zoom reveal before the idle drift loop. */
export const ONBOARDING_PROFILE_BG_ENTER_DURATION = 2.35;

export const onboardingProfileBgEnterTransition: Transition = {
  duration: ONBOARDING_PROFILE_BG_ENTER_DURATION,
  ease: ONBOARDING_EASE,
};
