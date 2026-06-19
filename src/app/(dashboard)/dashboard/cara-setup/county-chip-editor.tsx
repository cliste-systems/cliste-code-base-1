"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import {
  dedupeCaraSetupChips,
  findExactChipInList,
} from "@/lib/cara-setup-chips";
import { IRISH_COUNTIES } from "@/lib/irish-counties";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

const chipClass =
  "inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[13px] text-[#0b1220] shadow-sm";

export function CountyChipEditor({ value, onChange }: Props) {
  const reduceMotion = useReducedMotion();
  const chipTransition = reduceMotion ? { duration: 0 } : onboardingSpring;

  const availableCounties = IRISH_COUNTIES.filter(
    (county) =>
      !value.some((item) => item.toLowerCase() === county.toLowerCase()),
  );

  function addCounty(county: string) {
    if (findExactChipInList(county, value)) return;
    onChange(dedupeCaraSetupChips([...value, county]));
  }

  function removeCounty(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {availableCounties.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Counties">
          {availableCounties.map((county) => (
            <button
              key={county}
              type="button"
              onClick={() => addCounty(county)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {county}
            </button>
          ))}
        </div>
      ) : null}

      {value.length > 0 ? (
        <motion.ul
          layout
          className="flex flex-wrap gap-2"
          aria-label="Selected counties"
          transition={chipTransition}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {value.map((item, index) => (
              <motion.li
                key={`${item}-${index}`}
                layout="position"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.88, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? undefined
                    : { opacity: 0, scale: 0.88, transition: { duration: 0.16 } }
                }
                transition={chipTransition}
              >
                <span className={chipClass}>
                  <span className="truncate">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeCounty(index)}
                    className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Remove ${item}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      ) : null}
    </div>
  );
}
