"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

import { cn } from "@/lib/utils";

import {
  onboardingItemTransition,
  onboardingProfileItemTransition,
} from "./onboarding-motion";

type NextIndex = () => number;

const OnboardingEnterIndexContext = createContext<NextIndex | null>(null);

export function OnboardingEnterProvider({ children }: { children: ReactNode }) {
  const indexRef = useRef(0);
  const nextIndex = () => indexRef.current++;

  return (
    <OnboardingEnterIndexContext.Provider value={nextIndex}>
      {children}
    </OnboardingEnterIndexContext.Provider>
  );
}

type EnterTone = "default" | "profile";

/** Reserves the next slot in the onboarding entrance sequence (once per mount). */
export function useOnboardingEnterTransition(
  tone: EnterTone = "default",
): Transition | null {
  const nextIndex = useContext(OnboardingEnterIndexContext);
  const reduceMotion = useReducedMotion();
  const [index] = useState(() => nextIndex?.() ?? -1);

  if (reduceMotion || index < 0) {
    return null;
  }

  return tone === "profile"
    ? onboardingProfileItemTransition(index)
    : onboardingItemTransition(index);
}

/**
 * Motion must start after hydration — otherwise SSR paints visible content and
 * the client skips the entrance on hard refresh.
 */
export function useOnboardingAnimateIn(): boolean {
  const reduceMotion = useReducedMotion() ?? false;
  const [ready, setReady] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      // No entrance animation when reduced motion is requested.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      return;
    }

    let outer = 0;
    let inner = 0;
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [reduceMotion]);

  return ready;
}

type EnterProps = {
  children: ReactNode;
  className?: string;
  tone?: EnterTone;
};

const ENTER_INITIAL = {
  default: { opacity: 0, y: 10 },
  profile: { opacity: 0, y: 22, scale: 0.985, filter: "blur(6px)" },
} as const;

const ENTER_ANIMATE = {
  default: { opacity: 1, y: 0 },
  profile: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
} as const;

/** Fade/slide wrapper — use for logo, headline, fields, CTA. */
export function OnboardingEnter({
  children,
  className,
  tone = "default",
}: EnterProps) {
  const transition = useOnboardingEnterTransition(tone);
  const reduceMotion = useReducedMotion();
  const ready = useOnboardingAnimateIn();

  const mergedClass = cn("w-full", className);

  if (reduceMotion || !transition) {
    return <div className={mergedClass}>{children}</div>;
  }

  return (
    <motion.div
      className={mergedClass}
      initial={ENTER_INITIAL[tone]}
      animate={ready ? ENTER_ANIMATE[tone] : ENTER_INITIAL[tone]}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
