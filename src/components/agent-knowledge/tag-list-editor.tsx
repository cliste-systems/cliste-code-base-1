"use client";

import { Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type KeyboardEvent } from "react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

type Variant = "onboarding" | "dashboard";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel?: string;
  suggestions?: string[];
  maxItems?: number;
  emptyHint?: string;
  variant?: Variant;
  className?: string;
};

const tagChipMotion = {
  initial: { opacity: 0, scale: 0.88, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.88, transition: { duration: 0.16 } },
};

export function TagListEditor({
  value,
  onChange,
  placeholder,
  addLabel = "Add",
  suggestions = [],
  maxItems = 24,
  emptyHint = "Add items — press Enter or Add.",
  variant = "onboarding",
  className,
}: Props) {
  const [draft, setDraft] = useState("");
  const reduceMotion = useReducedMotion();
  const compact = variant === "onboarding";
  const chipTransition = reduceMotion ? { duration: 0 } : onboardingSpring;

  function addItem(raw: string, options?: { clearDraft?: boolean }) {
    const item = raw.trim();
    if (!item) return value;
    if (value.length >= maxItems) return value;
    if (value.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      if (options?.clearDraft !== false) setDraft("");
      return value;
    }
    const next = [...value, item];
    onChange(next);
    if (options?.clearDraft !== false) setDraft("");
    return next;
  }

  function onDraftChange(next: string) {
    if (!next.includes(",")) {
      setDraft(next);
      return;
    }
    const parts = next.split(",");
    const remainder = parts.pop() ?? "";
    let current = value;
    for (const part of parts) {
      const item = part.trim();
      if (!item) continue;
      if (current.length >= maxItems) break;
      if (
        current.some(
          (existing) => existing.toLowerCase() === item.toLowerCase(),
        )
      ) {
        continue;
      }
      current = [...current, item];
    }
    if (current !== value) onChange(current);
    setDraft(remainder);
  }

  function removeItem(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem(draft);
    }
  }

  const inputClass = cn(
    "min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-[#0b1220] shadow-none outline-none ring-0 placeholder:text-slate-400 focus-visible:ring-0",
    compact && "text-[14px]",
  );

  const chipClass =
    "inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[13px] text-[#0b1220] shadow-sm";

  const unusedSuggestions = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
        <input
          type="text"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={inputClass}
          disabled={value.length >= maxItems}
        />
        <button
          type="button"
          onClick={() => addItem(draft)}
          disabled={!draft.trim() || value.length >= maxItems}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[#0b1220] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#05070b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </button>
      </div>

      {value.length > 0 ? (
        <motion.ul
          layout
          className="flex flex-wrap gap-2"
          aria-label="Added items"
          transition={chipTransition}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {value.map((item, index) => (
              <motion.li
                key={`${item}-${index}`}
                layout="position"
                variants={reduceMotion ? undefined : tagChipMotion}
                initial={reduceMotion ? false : "initial"}
                animate={reduceMotion ? undefined : "animate"}
                exit={reduceMotion ? undefined : "exit"}
                transition={chipTransition}
                className={chipClass}
              >
                <span className="truncate">{item}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`Remove ${item}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      ) : emptyHint ? (
        <p className="text-[12px] text-slate-400">{emptyHint}</p>
      ) : null}

      {unusedSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {unusedSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addItem(suggestion)}
              disabled={value.length >= maxItems}
              className="cursor-pointer rounded-full border border-dashed border-slate-300/90 px-2.5 py-1 text-[12px] text-slate-500 transition-colors hover:border-slate-400 hover:text-[#0b1220] disabled:cursor-not-allowed disabled:opacity-50"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
