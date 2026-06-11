"use client";

import { Check, PenLine, Plus, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

const FAQ_PANEL = cn(
  "overflow-hidden rounded-[1.25rem] bg-white",
  "shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70",
);

const FAQ_SUGGESTION_ROW = cn(
  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
  "hover:bg-black/[0.02]",
);

const FAQ_SUGGESTION_LABEL = "min-w-0 flex-1 text-[14px] leading-snug text-slate-600";

const FAQ_ROW_ACTION = cn(
  "flex size-7 shrink-0 items-center justify-center rounded-full",
  "bg-[#0b1220]/[0.05] text-slate-500 transition-colors",
  "group-hover:bg-[#0b1220]/10 group-hover:text-[#0b1220]",
);

const FAQ_FIELD_INPUT =
  "w-full border-0 bg-transparent p-0 text-[14px] leading-snug text-[#0b1220] outline-none placeholder:text-slate-400";

const FAQ_FIELD_TEXTAREA = cn(
  "w-full min-h-[4.5rem] max-h-28 resize-none border-0 bg-transparent p-0",
  "text-[14px] leading-relaxed text-[#0b1220] outline-none placeholder:text-slate-400",
);

/** Same height spring as ExpandableTrainingTextarea in cara-training-step-shell. */
function FaqAnimatedHeightShell({
  className,
  onHeightAnimationComplete,
  children,
}: {
  className?: string;
  onHeightAnimationComplete?: () => void;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) {
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
  }, [children]);

  return (
    <motion.div layout="position" className={className}>
      <motion.div
        initial={false}
        animate={{ height: children ? height : 0 }}
        transition={reduceMotion ? { duration: 0 } : onboardingSpring}
        onAnimationComplete={onHeightAnimationComplete}
        className="overflow-hidden"
      >
        <div ref={contentRef}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

export const PANEL_SURFACE =
  "w-full rounded-[20px] border border-slate-200/70 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:px-6 sm:py-5";

export const FIELD_INPUT =
  "w-full rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-[15px] leading-relaxed text-[#0b1220] shadow-[0_4px_20px_rgba(15,23,42,0.04)] outline-none placeholder:text-slate-400 focus-visible:border-[#0b1220]/15 focus-visible:ring-2 focus-visible:ring-[#0b1220]/6";

export function CallFlowRouteCard({
  children,
  status,
  fallback,
  onEdit,
  onRemove,
}: {
  children: ReactNode;
  status: string;
  fallback?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white px-4 py-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] sm:px-5",
        fallback
          ? "border-[#0b1220]/15 bg-[#0b1220]/[0.02]"
          : "border-slate-200/75",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-3 left-0 w-0.5 rounded-full",
          fallback ? "bg-[#0b1220]/40" : "bg-[#0b1220]/20",
        )}
        aria-hidden
      />
      <div className="space-y-3 pl-3">
        <p className="text-[14px] leading-relaxed text-[#0b1220] sm:text-[15px]">
          {children}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              fallback
                ? "bg-[#0b1220]/8 text-[#0b1220]"
                : "bg-slate-100 text-slate-600",
            )}
          >
            {status}
          </span>
          {!fallback && onEdit ? (
            <button
              type="button"
              className="text-[12px] font-medium text-slate-500 transition-colors hover:text-[#0b1220]"
              onClick={onEdit}
            >
              Edit
            </button>
          ) : null}
          {!fallback && onRemove ? (
            <button
              type="button"
              className="text-[12px] font-medium text-slate-500 transition-colors hover:text-red-600"
              onClick={onRemove}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <OnboardingEnter>
      <div className="space-y-2">
        <p className="text-[14px] font-medium text-[#0b1220]">{label}</p>
        {children}
      </div>
    </OnboardingEnter>
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
}: {
  faq: AgentFaq;
  onChange: (patch: Partial<AgentFaq>) => void;
  onDone: () => void;
  onCancel: () => void;
  focusAnswer: boolean;
  disabled?: boolean;
  questionPlaceholder?: string;
  answerPlaceholder?: string;
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
    <div className="space-y-3">
      <input
        ref={questionRef}
        value={faq.question}
        disabled={disabled}
        onChange={(event) => onChange({ question: event.target.value })}
        className={FAQ_FIELD_INPUT}
        placeholder={questionPlaceholder}
        aria-label="Question"
      />
      <div className="border-t border-[#0b1220]/[0.06] pt-3">
        <textarea
          ref={answerRef}
          value={faq.answer}
          disabled={disabled}
          rows={2}
          onChange={(event) => onChange({ answer: event.target.value })}
          onKeyDown={handleAnswerKeyDown}
          className={FAQ_FIELD_TEXTAREA}
          placeholder={answerPlaceholder}
          aria-label="Answer"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-0.5">
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
          disabled={disabled || !faq.question.trim()}
          className="h-9 px-3.5 text-[13px] shadow-[0_4px_16px_rgba(11,18,32,0.2)]"
        >
          <Check className="size-3.5" aria-hidden />
          Done
        </OnboardingPrimaryButton>
      </div>
    </div>
  );
}

/** Compact FAQ list: one editor at a time, scrollable saved rows. */
export function CaraCommonQuestionsField({
  faqs,
  suggestions,
  maxFaqs,
  onChange,
  disabled = false,
  questionPlaceholder,
  answerPlaceholder,
}: {
  faqs: AgentFaq[];
  suggestions: readonly string[];
  maxFaqs: number;
  onChange: (faqs: AgentFaq[]) => void;
  disabled?: boolean;
  questionPlaceholder?: string;
  answerPlaceholder?: string;
}) {
  /** Which FAQ row is being edited — kept through exit so content stays mounted. */
  const [editorSessionIndex, setEditorSessionIndex] = useState<number | null>(null);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [removeOnExitIndex, setRemoveOnExitIndex] = useState<number | null>(null);
  const pendingEditorCloseRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const layoutTransition = reduceMotion ? { duration: 0 } : onboardingSpring;

  const unusedSuggestions = suggestions.filter(
    (q) => !faqs.some((faq) => faq.question.trim().toLowerCase() === q.toLowerCase()),
  );

  const canAdd = faqs.length < maxFaqs;

  function openEditor(index: number) {
    pendingEditorCloseRef.current = false;
    setEditorSessionIndex(index);
    setIsEditorVisible(true);
  }

  function closeEditor(index: number) {
    const faq = faqs[index];
    const isEmpty = !faq?.question.trim() && !faq?.answer.trim();
    if (isEmpty) {
      setRemoveOnExitIndex(index);
    }
    pendingEditorCloseRef.current = true;
    setIsEditorVisible(false);
  }

  function handleEditorExitAnimationComplete() {
    if (!pendingEditorCloseRef.current) return;
    pendingEditorCloseRef.current = false;
    handleEditorExitComplete();
  }

  function handleEditorExitComplete() {
    if (removeOnExitIndex !== null) {
      const index = removeOnExitIndex;
      onChange(faqs.filter((_, i) => i !== index));
      setRemoveOnExitIndex(null);
    }
    setEditorSessionIndex(null);
  }

  function addFaq(question: string, answer: string) {
    if (!canAdd || disabled) return;
    const next = [...faqs, { question, answer }];
    onChange(next);
    openEditor(next.length - 1);
  }

  function updateAt(index: number, patch: Partial<AgentFaq>) {
    onChange(faqs.map((faq, i) => (i === index ? { ...faq, ...patch } : faq)));
  }

  function removeAt(index: number) {
    if (editorSessionIndex === index) {
      setIsEditorVisible(false);
      setRemoveOnExitIndex(null);
    }
    onChange(faqs.filter((_, i) => i !== index));
    setEditorSessionIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  }

  function finishEditing(index: number) {
    const faq = faqs[index];
    if (!faq?.question.trim()) {
      closeEditor(index);
      return;
    }
    closeEditor(index);
  }

  function cancelEditing(index: number) {
    closeEditor(index);
  }

  const savedRows = faqs
    .map((faq, index) => ({ faq, index }))
    .filter(({ index }) => editorSessionIndex !== index);

  const showEditor =
    isEditorVisible &&
    editorSessionIndex !== null &&
    faqs[editorSessionIndex] !== undefined;

  const showPicker = canAdd && !disabled && !isEditorVisible;

  return (
    <motion.div layout="position" transition={layoutTransition} className={cn(FAQ_PANEL, "mx-auto w-full")}>
      {savedRows.length > 0 ? (
        <ul
          className="max-h-[min(220px,36vh)] divide-y divide-[#0b1220]/[0.06] overflow-y-auto overscroll-y-contain"
          aria-label="Saved questions"
        >
          {savedRows.map(({ faq, index }) => (
            <motion.li
              key={`faq-saved-${index}-${faq.question}`}
              layout="position"
              transition={onboardingSpring}
              className="flex items-start gap-1 pr-1"
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => openEditor(index)}
                className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] disabled:opacity-50"
              >
                <span className="block truncate text-[14px] font-medium text-[#0b1220]">
                  {faq.question.trim()}
                </span>
                {faq.answer.trim() ? (
                  <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                    {faq.answer.trim()}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[12px] text-slate-400">
                    Tap to add an answer
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeAt(index)}
                aria-label="Remove question"
                className="mt-2.5 mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-black/[0.04] hover:text-red-600 disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </motion.li>
          ))}
        </ul>
      ) : null}

      <FaqAnimatedHeightShell
        className={cn(savedRows.length > 0 && "border-t border-[#0b1220]/[0.06]")}
        onHeightAnimationComplete={handleEditorExitAnimationComplete}
      >
        {showEditor ? (
          <div className="p-4">
            <FaqEditorPanel
              faq={faqs[editorSessionIndex]!}
              focusAnswer={Boolean(faqs[editorSessionIndex]!.question.trim())}
              disabled={disabled}
              questionPlaceholder={questionPlaceholder}
              answerPlaceholder={answerPlaceholder}
              onChange={(patch) => updateAt(editorSessionIndex, patch)}
              onDone={() => finishEditing(editorSessionIndex)}
              onCancel={() => cancelEditing(editorSessionIndex)}
            />
          </div>
        ) : showPicker ? (
          <div className="divide-y divide-[#0b1220]/[0.06]">
            {unusedSuggestions.slice(0, 3).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => addFaq(q, "")}
                className={cn(FAQ_SUGGESTION_ROW, "group")}
              >
                <span className={FAQ_SUGGESTION_LABEL}>{q}</span>
                <span className={FAQ_ROW_ACTION} aria-hidden>
                  <Plus className="size-3.5" />
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => addFaq("", "")}
              className={cn(
                FAQ_SUGGESTION_ROW,
                "group bg-[#0b1220]/[0.02] hover:bg-[#0b1220]/[0.04]",
              )}
            >
              <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-[#0b1220]">
                Write your own question
              </span>
              <span
                className={cn(
                  FAQ_ROW_ACTION,
                  "bg-[#0b1220]/10 text-[#0b1220] group-hover:bg-[#0b1220]/15",
                )}
                aria-hidden
              >
                <PenLine className="size-3.5" />
              </span>
            </button>
          </div>
        ) : null}
      </FaqAnimatedHeightShell>
    </motion.div>
  );
}
