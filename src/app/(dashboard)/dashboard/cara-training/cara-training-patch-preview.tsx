"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_MD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type Props = {
  lines: string[];
  applied: boolean;
  className?: string;
};

export function CaraTrainingPatchPreview({ lines, applied, className }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-18px_rgba(15,23,42,0.28)]",
        className,
      )}
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {!reduceMotion ? (
        <motion.div
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#0b1220]/35 to-transparent"
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      ) : null}

      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className={DASHBOARD_ICON_CHIP_MD}>
          {applied ? (
            <CheckCircle2 className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
          ) : (
            <Sparkles className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {applied ? "Added to your setup" : "Preview — what Cara will add"}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {lines.map((line, index) => (
              <motion.li
                key={line}
                className="text-[13px] leading-relaxed text-[#0b1220]"
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: reduceMotion ? 0 : 0.06 + index * 0.07,
                  duration: 0.34,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {line}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
