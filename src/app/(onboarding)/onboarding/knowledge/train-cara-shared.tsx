"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

import { TrainCaraInlineNotice } from "./train-cara-inline-notice";
import {
  lintOnboardingFaq,
  type TrainCaraFaqGuardContext,
} from "./train-cara-faq-guardrails";

const FAQ_PANEL = cn(
  "overflow-hidden rounded-[1.25rem] bg-white",
  "shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70",
);

const FAQ_VISIBLE_ROWS = 4;
/** One collapsed row — list caps at four rows then scrolls. */
const FAQ_COLLAPSED_ROW_CLASS = "min-h-16";
const FAQ_LIST_MAX_HEIGHT = "max-h-64";

const FAQ_FIELD_INPUT = cn(
  "block h-11 w-full appearance-none rounded-lg bg-white px-3",
  "text-[14px] leading-normal text-[#0b1220] outline-none placeholder:text-slate-400",
  "ring-1 ring-slate-200/70 focus:ring-[#0b1220]/15",
);

const FAQ_FIELD_TEXTAREA = cn(
  "block w-full min-h-[5.5rem] resize-none rounded-lg bg-white px-3 py-3",
  "text-[14px] leading-relaxed text-[#0b1220] outline-none placeholder:text-slate-400",
  "ring-1 ring-slate-200/70 focus:ring-[#0b1220]/15",
);

type EditorTarget = { mode: "edit"; index: number } | null;

function FaqAnimatedHeightShell({
  className,
  open,
  children,
}: {
  className?: string;
  open: boolean;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node || !open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeight(0);
      return;
    }

    const measure = () => {
      setHeight(node.scrollHeight);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children, open]);

  return (
    <motion.div layout="position" className={className}>
      <motion.div
        initial={false}
        animate={{
          height: open && children ? height : 0,
        }}
        transition={reduceMotion ? { duration: 0 } : onboardingSpring}
        className="overflow-hidden"
      >
        <div ref={contentRef}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

function FaqEditorPanel({
  faq,
  onChange,
  onDone,
  onCancel,
  focusAnswer,
  disabled = false,
  questionPlaceholder = "What do callers ask?",
  answerPlaceholder = "What Cara should say",
  guardWarning = null,
}: {
  faq: AgentFaq;
  onChange: (patch: Partial<AgentFaq>) => void;
  onDone: () => void;
  onCancel: () => void;
  focusAnswer: boolean;
  disabled?: boolean;
  questionPlaceholder?: string;
  answerPlaceholder?: string;
  guardWarning?: string | null;
}) {
  const questionRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusAnswer) {
      answerRef.current?.focus();
    } else {
      questionRef.current?.focus();
    }
  }, [focusAnswer]);

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onDone();
    }
  }

  return (
    <div className="space-y-4 bg-slate-50/50 px-4 py-4">
      <TrainCaraInlineNotice message={guardWarning ?? undefined} tone="attention" />
      <div className="space-y-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.05em] text-slate-500">
          Question
        </label>
        <input
          ref={questionRef}
          value={faq.question}
          disabled={disabled}
          onChange={(event) => onChange({ question: event.target.value })}
          className={FAQ_FIELD_INPUT}
          placeholder={questionPlaceholder}
          aria-label="Question"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.05em] text-slate-500">
          Cara&apos;s answer
        </label>
        <textarea
          ref={answerRef}
          value={faq.answer}
          disabled={disabled}
          rows={3}
          onChange={(event) => onChange({ answer: event.target.value })}
          onKeyDown={handleAnswerKeyDown}
          className={FAQ_FIELD_TEXTAREA}
          placeholder={answerPlaceholder}
          aria-label="Answer"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-[#0b1220] disabled:opacity-50"
        >
          Cancel
        </button>
        <OnboardingPrimaryButton
          type="button"
          onClick={onDone}
          disabled={disabled || !faq.question.trim() || Boolean(guardWarning)}
          className="h-9 px-3.5 text-[13px] shadow-[0_4px_16px_rgba(11,18,32,0.2)]"
        >
          <Check className="size-3.5" aria-hidden />
          Done
        </OnboardingPrimaryButton>
      </div>
    </div>
  );
}

/** Centered FAQ list — one animated editor at a time, static common-question chips. */
export function CaraCommonQuestionsField({
  faqs,
  maxFaqs,
  onChange,
  disabled = false,
  questionPlaceholder,
  answerPlaceholder,
  guardContext,
}: {
  faqs: AgentFaq[];
  maxFaqs: number;
  onChange: (faqs: AgentFaq[]) => void;
  disabled?: boolean;
  questionPlaceholder?: string;
  answerPlaceholder?: string;
  guardContext: TrainCaraFaqGuardContext;
}) {
  const [editor, setEditor] = useState<EditorTarget>(null);
  const reduceMotion = useReducedMotion();
  const layoutTransition = reduceMotion ? { duration: 0 } : onboardingSpring;

  const canAdd = faqs.length < maxFaqs;
  const isEditing = editor !== null;

  function closeEditor(index: number | null) {
    if (index !== null) {
      const faq = faqs[index];
      const isEmpty = !faq?.question.trim() && !faq?.answer.trim();
      if (isEmpty) {
        onChange(faqs.filter((_, i) => i !== index));
      }
    }
    setEditor(null);
  }

  function openEdit(index: number) {
    if (disabled) return;
    setEditor({ mode: "edit", index });
  }

  function openNew() {
    if (!canAdd || disabled) return;
    const next = [...faqs, { question: "", answer: "" }];
    onChange(next);
    setEditor({ mode: "edit", index: next.length - 1 });
  }

  function updateAt(index: number, patch: Partial<AgentFaq>) {
    onChange(faqs.map((faq, i) => (i === index ? { ...faq, ...patch } : faq)));
  }

  function removeAt(index: number) {
    if (editor?.mode === "edit" && editor.index === index) {
      setEditor(null);
    } else if (editor?.mode === "edit" && editor.index > index) {
      setEditor({ mode: "edit", index: editor.index - 1 });
    }
    onChange(faqs.filter((_, i) => i !== index));
  }

  function finishEditing(index: number) {
    const faq = faqs[index];
    if (!faq?.question.trim()) {
      closeEditor(index);
      return;
    }
    closeEditor(index);
  }

  const activeIndex = editor?.mode === "edit" ? editor.index : null;
  const activeRowRef = useRef<HTMLLIElement>(null);

  const activeGuardWarning =
    activeIndex !== null && faqs[activeIndex]
      ? lintOnboardingFaq({
          faq: faqs[activeIndex]!,
          index: activeIndex,
          faqs,
          context: guardContext,
        })?.message ?? null
      : null;

  useEffect(() => {
    if (activeIndex === null) return;
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <motion.div
      layout="position"
      transition={layoutTransition}
      className="mx-auto w-full max-w-lg"
    >
      <div className={FAQ_PANEL}>
        {faqs.length === 0 && activeIndex === null ? (
          <p className="px-4 py-8 text-center text-[13px] text-slate-400">
            Add a question Cara can answer on calls.
          </p>
        ) : (
          <ul
            className={cn(
              "divide-y divide-[#0b1220]/[0.06]",
              faqs.length >= FAQ_VISIBLE_ROWS && FAQ_LIST_MAX_HEIGHT,
              faqs.length >= FAQ_VISIBLE_ROWS && "overflow-y-auto overscroll-y-contain",
            )}
          >
            {faqs.map((faq, index) => {
              const isActive = activeIndex === index;
              const hasAnswer = Boolean(faq.answer.trim());

              return (
                <li
                  key={`faq-${index}-${faq.question}`}
                  ref={isActive ? activeRowRef : undefined}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1 transition-colors",
                      FAQ_COLLAPSED_ROW_CLASS,
                      isActive && "bg-[#0b1220]/[0.04]",
                    )}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => (isActive ? closeEditor(index) : openEdit(index))}
                      aria-expanded={isActive}
                      className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left disabled:opacity-50"
                    >
                      <motion.span
                        animate={{ rotate: isActive ? 180 : 0 }}
                        transition={layoutTransition}
                        className="shrink-0 text-slate-400"
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </motion.span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[#0b1220]">
                          {faq.question.trim() || "New question"}
                        </span>
                        {hasAnswer ? (
                          <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                            {faq.answer.trim()}
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-[12px] text-amber-700/90">
                            Needs an answer
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeAt(index)}
                      aria-label="Remove question"
                      className="mr-2 flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <FaqAnimatedHeightShell open={isEditing} className="border-t border-[#0b1220]/[0.08]">
          {activeIndex !== null && faqs[activeIndex] ? (
              <FaqEditorPanel
                faq={faqs[activeIndex]}
                focusAnswer={Boolean(faqs[activeIndex]!.question.trim())}
                disabled={disabled}
                questionPlaceholder={questionPlaceholder}
                answerPlaceholder={answerPlaceholder}
                guardWarning={activeGuardWarning}
                onChange={(patch) => updateAt(activeIndex, patch)}
                onDone={() => finishEditing(activeIndex)}
                onCancel={() => closeEditor(activeIndex)}
              />
          ) : null}
        </FaqAnimatedHeightShell>

        {canAdd && !isEditing ? (
          <div className="border-t border-[#0b1220]/[0.06] p-4">
            <button
              type="button"
              disabled={disabled}
              onClick={openNew}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-2.5",
                "text-[14px] font-medium text-[#0b1220] transition-colors",
                "ring-1 ring-[#0b1220]/10 hover:bg-[#0b1220]/[0.03] hover:ring-[#0b1220]/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Plus className="size-4" aria-hidden />
              Add a question
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
