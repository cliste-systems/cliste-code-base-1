"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import {
  ONBOARDING_HEADLINE,
  ONBOARDING_SUBHEADLINE,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

/** Shared white card surface for Train Cara steps (no frosted glass). */
export const TRAINING_SURFACE = cn(
  "rounded-[1.25rem] border border-slate-200/70 bg-white",
  "shadow-[0_8px_30px_rgba(15,23,42,0.06)]",
);

/** Single calm input surface — white card, no frosted glass box. */
export const TRAINING_TEXTAREA = cn(
  TRAINING_SURFACE,
  "box-border block w-full resize-none overflow-y-auto px-5 py-3.5",
  "text-[15px] leading-[1.65] text-[#0b1220]",
  "outline-none transition-[border-color,box-shadow] duration-200",
  "placeholder:text-slate-400/80",
  "focus:border-[#0b1220]/15 focus:shadow-[0_12px_40px_rgba(15,23,42,0.08)]",
);

const ABOUT_TEXTAREA_COLLAPSED = "11.5rem";
const ABOUT_TEXTAREA_EXPANDED = "22rem";

const DUAL_PRIMARY_COLLAPSED = "6.5rem";
const DUAL_PRIMARY_EXPANDED = "14rem";

const DUAL_SECONDARY_COLLAPSED = "5.5rem";
const DUAL_SECONDARY_EXPANDED = "12rem";

const EXPAND_TOGGLE = cn(
  "absolute bottom-2.5 right-2.5 z-10 flex size-8 items-center justify-center rounded-lg",
  "border border-[#0b1220]/[0.08] bg-white/90 text-slate-500 shadow-[0_2px_8px_rgba(15,23,42,0.08)]",
  "transition-[color,background-color,box-shadow] duration-200",
  "hover:bg-white hover:text-[#0b1220] hover:shadow-[0_4px_14px_rgba(15,23,42,0.1)]",
  "disabled:pointer-events-none disabled:opacity-50",
);

type ExpandableTrainingTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  collapsedHeight: string;
  expandedHeight: string;
  disabled?: boolean;
  "aria-label": string;
};

function ExpandableTrainingTextarea({
  value,
  onChange,
  placeholder,
  collapsedHeight,
  expandedHeight,
  disabled = false,
  "aria-label": ariaLabel,
}: ExpandableTrainingTextareaProps) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto w-full">
      <motion.div
        layout
        initial={false}
        animate={{ height: expanded ? expandedHeight : collapsedHeight }}
        transition={reduceMotion ? { duration: 0 } : onboardingSpring}
        className="relative overflow-hidden rounded-[1.25rem]"
      >
        <textarea
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            TRAINING_TEXTAREA,
            "absolute inset-0 h-full pb-11",
            "rounded-[1.25rem]",
          )}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={expanded ? "Make writing box smaller" : "Make writing box bigger"}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className={EXPAND_TOGGLE}
        >
          {expanded ? (
            <Minimize2 className="size-3.5" aria-hidden />
          ) : (
            <Maximize2 className="size-3.5" aria-hidden />
          )}
        </button>
      </motion.div>
    </div>
  );
}

type ExpandableAboutTextareaProps = Omit<
  ExpandableTrainingTextareaProps,
  "collapsedHeight" | "expandedHeight"
>;

function ExpandableAboutTextarea(props: ExpandableAboutTextareaProps) {
  return (
    <ExpandableTrainingTextarea
      {...props}
      collapsedHeight={ABOUT_TEXTAREA_COLLAPSED}
      expandedHeight={ABOUT_TEXTAREA_EXPANDED}
    />
  );
}

type ShellProps = {
  title: string;
  subtitle: string;
  helper?: string;
  children: ReactNode;
  className?: string;
  /** Tighter vertical rhythm for the review summary card. */
  compact?: boolean;
};

export function CaraTrainingStepShell({
  title,
  subtitle,
  helper,
  children,
  className,
  compact = false,
}: ShellProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center self-center",
        compact ? "gap-3" : "gap-4 sm:gap-5",
        className,
      )}
    >
      <header className={cn("w-full space-y-1 text-center", compact && "space-y-0.5")}>
        <h1
          className={cn(
            compact
              ? "text-center text-[1.25rem] font-semibold leading-snug tracking-tight text-[#0b1220] sm:text-[1.375rem]"
              : ONBOARDING_HEADLINE,
          )}
        >
          {title}
        </h1>
        <p
          className={cn(
            ONBOARDING_SUBHEADLINE,
            "mx-auto",
            compact ? "max-w-md text-[12px]" : "max-w-xl",
          )}
        >
          {subtitle}
        </p>
      </header>

      <div className="min-h-0 w-full space-y-2">{children}</div>

      {helper ? (
        <p className="w-full text-center text-[12px] leading-relaxed text-slate-400/90">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

type TextareaStepProps = {
  title: string;
  subtitle: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  label?: string;
  expandable?: boolean;
};

export function CaraTextareaStep({
  title,
  subtitle,
  helper,
  value,
  onChange,
  placeholder,
  disabled = false,
  label,
  expandable = false,
}: TextareaStepProps) {
  return (
    <CaraTrainingStepShell title={title} subtitle={subtitle} helper={helper}>
      {label ? (
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
      ) : null}
      {expandable ? (
        <ExpandableAboutTextarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label ?? title}
        />
      ) : (
        <textarea
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label ?? title}
          onChange={(event) => onChange(event.target.value)}
          className={cn(TRAINING_TEXTAREA, "h-[11.5rem]")}
        />
      )}
    </CaraTrainingStepShell>
  );
}

type DualTextareaStepProps = {
  title: string;
  subtitle: string;
  helper?: string;
  primaryLabel: string;
  primaryValue: string;
  primaryPlaceholder: string;
  secondaryLabel: string;
  secondaryValue: string;
  secondaryPlaceholder: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  disabled?: boolean;
};

export function CaraDualTextareaStep({
  title,
  subtitle,
  helper,
  primaryLabel,
  primaryValue,
  primaryPlaceholder,
  secondaryLabel,
  secondaryValue,
  secondaryPlaceholder,
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
}: DualTextareaStepProps) {
  return (
    <CaraTrainingStepShell title={title} subtitle={subtitle} helper={helper}>
      <div className="w-full space-y-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            {primaryLabel}
          </p>
          <ExpandableTrainingTextarea
            value={primaryValue}
            disabled={disabled}
            placeholder={primaryPlaceholder}
            aria-label={primaryLabel}
            collapsedHeight={DUAL_PRIMARY_COLLAPSED}
            expandedHeight={DUAL_PRIMARY_EXPANDED}
            onChange={onPrimaryChange}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            {secondaryLabel}
          </p>
          <ExpandableTrainingTextarea
            value={secondaryValue}
            disabled={disabled}
            placeholder={secondaryPlaceholder}
            aria-label={secondaryLabel}
            collapsedHeight={DUAL_SECONDARY_COLLAPSED}
            expandedHeight={DUAL_SECONDARY_EXPANDED}
            onChange={onSecondaryChange}
          />
        </div>
      </div>
    </CaraTrainingStepShell>
  );
}
