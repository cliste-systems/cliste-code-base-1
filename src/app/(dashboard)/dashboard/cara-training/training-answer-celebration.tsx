"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { dashboardQuickEnterTransition } from "@/components/dashboard/dashboard-motion";
import { cn } from "@/lib/utils";

export type TrainingAnswerCelebrateChoice = "saved";

const CHOICE_COPY: Record<TrainingAnswerCelebrateChoice, string> = {
  saved: "Saved to Cara's knowledge",
};

const CHOICE_SUBTITLE: Record<TrainingAnswerCelebrateChoice, string> = {
  saved: "Cara can use this answer on future calls.",
};

type TrainingAnswerCelebrationProps = {
  choice: TrainingAnswerCelebrateChoice;
  className?: string;
};

export function TrainingAnswerCelebration({
  choice,
  className,
}: TrainingAnswerCelebrationProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div
        className={cn(
          "rounded-lg border border-[#cfe8d8] bg-[#f3fbf6] px-4 py-3 text-[13px] font-medium text-[#14532d]",
          className,
        )}
      >
        {CHOICE_COPY[choice]}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={dashboardQuickEnterTransition}
      className={cn(
        "relative overflow-hidden rounded-lg border border-[#a7e3bf] bg-[#ecfdf3] px-4 py-3 shadow-[0_8px_24px_rgba(16,185,129,0.12)] ring-2 ring-emerald-200/80",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...dashboardQuickEnterTransition, delay: 0.05 }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
        >
          <Check className="size-4" aria-hidden />
        </motion.span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#14532d]">
            {CHOICE_COPY[choice]}
          </p>
          <p className="mt-0.5 text-[12px] text-emerald-800/80">
            {CHOICE_SUBTITLE[choice]}
          </p>
        </div>
      </div>
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 0.55, 0], scale: [0.8, 1.15, 1.25] }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 rounded-lg bg-emerald-300/20"
      />
    </motion.div>
  );
}

export function TrainingDraftReveal({
  children,
  revealKey,
}: {
  children: React.ReactNode;
  revealKey: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={revealKey}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={dashboardQuickEnterTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
