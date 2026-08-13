"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

type NoticeTone = "brand" | "attention";

const TONE_CLASS: Record<NoticeTone, string> = {
  brand:
    "border-[#0b1220]/12 bg-[#0b1220]/[0.04] text-slate-700",
  attention:
    "border-amber-300/70 bg-amber-50/95 text-[#0b1220]/90",
};

type Props = {
  message?: string;
  tone?: NoticeTone;
  className?: string;
};

export function TrainCaraInlineNotice({
  message,
  tone = "brand",
  className,
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          key={message}
          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={reduceMotion ? { duration: 0 } : onboardingSpring}
          className={cn(
            "mb-3 rounded-lg border px-3 py-2 text-center text-[12px] leading-relaxed",
            TONE_CLASS[tone],
            className,
          )}
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
