"use client";

import { Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import {
  CARA_SETUP_CHIP_MAX_LENGTH,
  dedupeCaraSetupChips,
  findExactChipInList,
  findNearDuplicateChip,
  isCaraSetupChipTooLong,
  normalizeCaraSetupChip,
  splitCaraSetupChipInput,
} from "@/lib/cara-setup-chips";

const tagChipMotion = {
  initial: { opacity: 0, scale: 0.88, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.88, transition: { duration: 0.16 } },
};

export type ChipBeforeAddResult =
  | { outcome: "allow"; warn?: string }
  | { outcome: "block"; message: string }
  | { outcome: "interrupt"; kind: string; item: string };

export type CaraSetupChipEditorProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  inputId: string;
  maxItems?: number;
  beforeAdd: (item: string) => ChipBeforeAddResult;
  nearDupLists?: string[][];
  listBanner?: ReactNode;
  renderInterruptDialog?: (ctx: {
    kind: string;
    item: string;
    close: () => void;
    confirmAdd: (item: string) => void;
    draft: string;
    clearDraft: () => void;
  }) => ReactNode;
};

export function CaraSetupChipEditor({
  value,
  onChange,
  placeholder,
  inputId,
  maxItems,
  beforeAdd,
  nearDupLists = [],
  listBanner,
  renderInterruptDialog,
}: CaraSetupChipEditorProps) {
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineWarn, setInlineWarn] = useState<string | null>(null);
  const [lengthHint, setLengthHint] = useState<string | null>(null);
  const [commaPreview, setCommaPreview] = useState<string[] | null>(null);
  const [interrupt, setInterrupt] = useState<{
    kind: string;
    item: string;
  } | null>(null);
  const reduceMotion = useReducedMotion();
  const chipTransition = reduceMotion ? { duration: 0 } : onboardingSpring;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function commitItems(items: string[]) {
    const normalized = dedupeCaraSetupChips(items);
    if (
      normalized.length === value.length &&
      normalized.every((item, i) => item === value[i])
    ) {
      return;
    }
    onChange(normalized);
  }

  function applyBeforeAdd(item: string): boolean {
    const normalized = normalizeCaraSetupChip(item);
    setInlineError(null);
    setInlineWarn(null);
    setLengthHint(null);

    if (!normalized) return false;

    if (maxItems !== undefined && value.length >= maxItems) {
      setInlineError(`You can add up to ${maxItems} items.`);
      return false;
    }

    const exact = findExactChipInList(normalized, value);
    if (exact) {
      setToast(`"${exact}" is already on this list.`);
      setDraft("");
      return false;
    }

    const result = beforeAdd(normalized);
    if (result.outcome === "block") {
      setInlineError(result.message);
      return false;
    }
    if (result.outcome === "interrupt") {
      setInterrupt({ kind: result.kind, item: result.item });
      return false;
    }

    let nearDup: string | null = null;
    for (const list of nearDupLists) {
      nearDup = findNearDuplicateChip(normalized, list);
      if (nearDup) break;
    }
    if (!nearDup) {
      nearDup = findNearDuplicateChip(normalized, value);
    }
    if (nearDup) {
      setInlineWarn(`Looks similar to "${nearDup}" — check you need both.`);
    }

    if (isCaraSetupChipTooLong(normalized)) {
      setLengthHint(
        `Keep each one short (under ${CARA_SETUP_CHIP_MAX_LENGTH} characters) — caveats and conditions work better as a Common question.`,
      );
    }

    if (result.outcome === "allow" && result.warn) {
      setInlineWarn(result.warn);
    }

    commitItems([...value, normalized]);
    setDraft("");
    return true;
  }

  function requestAddFromDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    if (trimmed.includes(",")) {
      setCommaPreview(splitCaraSetupChipInput(trimmed));
      return;
    }

    applyBeforeAdd(trimmed);
  }

  function confirmCommaPreview() {
    if (!commaPreview?.length) {
      setCommaPreview(null);
      return;
    }
    let next = [...value];
    for (const item of commaPreview) {
      if (findExactChipInList(item, next)) continue;
      const result = beforeAdd(item);
      if (result.outcome === "block") {
        setInlineError(result.message);
        setCommaPreview(null);
        return;
      }
      if (result.outcome === "interrupt") {
        setInterrupt({ kind: result.kind, item: result.item });
        setCommaPreview(null);
        return;
      }
      next = [...next, item];
    }
    commitItems(next);
    setDraft("");
    setCommaPreview(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      requestAddFromDraft();
    }
  }

  function removeItem(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const chipClass =
    "inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[13px] text-[#0b1220] shadow-sm";

  return (
    <>
      <div className="flex flex-col gap-2">
        {listBanner ? <div>{listBanner}</div> : null}

        <div className="relative flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
          <input
            id={inputId}
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setInlineError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-[#0b1220] shadow-none outline-none ring-0 placeholder:text-slate-400 focus-visible:ring-0"
          />
          <button
            type="button"
            onClick={requestAddFromDraft}
            disabled={!draft.trim()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[#0b1220] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#05070b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden />
            Add
          </button>
          {toast ? (
            <p
              role="status"
              className="absolute left-0 top-full z-10 mt-1.5 rounded-lg border border-slate-200 bg-[#0b1220] px-3 py-1.5 text-[12px] text-white shadow-md"
            >
              {toast}
            </p>
          ) : null}
        </div>

        {inlineError ? (
          <p className="text-[12.5px] text-red-600">{inlineError}</p>
        ) : null}
        {inlineWarn ? (
          <p className="text-[12.5px] text-amber-800">{inlineWarn}</p>
        ) : null}
        {lengthHint ? (
          <p className="text-[12.5px] text-slate-500">{lengthHint}</p>
        ) : null}

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
        ) : null}
      </div>

      <Dialog open={commaPreview !== null} onOpenChange={() => setCommaPreview(null)}>
        <DialogContent
          showCloseButton
          className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-md"
        >
          <DialogHeader className="space-y-0 px-5 pt-5 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              Add these items?
            </DialogTitle>
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              Check the split looks right before adding.
            </DialogDescription>
            <div className="mt-4 flex flex-wrap gap-2">
              {(commaPreview ?? []).map((item) => (
                <span key={item} className={chipClass}>
                  {item}
                </span>
              ))}
            </div>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCommaPreview(null)}
              className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
            >
              Edit
            </Button>
            <Button
              type="button"
              onClick={confirmCommaPreview}
              className={DASHBOARD_PRIMARY_BUTTON_CLASS}
            >
              Add all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {interrupt && renderInterruptDialog
        ? renderInterruptDialog({
            kind: interrupt.kind,
            item: interrupt.item,
            close: () => setInterrupt(null),
            confirmAdd: (item) => {
              applyBeforeAdd(item);
              setInterrupt(null);
            },
            draft,
            clearDraft: () => setDraft(""),
          })
        : null}
    </>
  );
}
