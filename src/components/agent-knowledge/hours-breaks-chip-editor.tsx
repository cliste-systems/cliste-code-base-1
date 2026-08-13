"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import {
  findExactChipInList,
  normalizeCaraSetupChip,
} from "@/lib/cara-setup-chips";
import {
  canAddHoursBreak,
  parseHoursBreaks,
  serializeHoursBreaks,
} from "@/lib/hours-breaks";
import { cn } from "@/lib/utils";

type HoursBreaksChipEditorProps = {
  value: string;
  onChange: (next: string) => void;
  inputId?: string;
  className?: string;
};

const chipClass =
  "inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[13px] text-[#0b1220] shadow-sm";

export function HoursBreaksChipEditor({
  value,
  onChange,
  inputId = "hours-breaks",
  className,
}: HoursBreaksChipEditorProps) {
  const chips = parseHoursBreaks(value);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function commitDraft(raw: string): boolean {
    const normalized = normalizeCaraSetupChip(raw);
    if (!normalized) return false;

    if (findExactChipInList(normalized, chips)) {
      setMessage(`"${normalized}" is already added.`);
      setDraft("");
      return false;
    }

    const check = canAddHoursBreak(chips, normalized);
    if (!check.ok) {
      setMessage(check.message);
      return false;
    }

    onChange(serializeHoursBreaks([...chips, normalized]));
    setDraft("");
    setMessage(null);
    return true;
  }

  function removeChip(index: number) {
    const next = chips.filter((_, i) => i !== index);
    onChange(serializeHoursBreaks(next));
    setMessage(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft(draft);
      return;
    }

    if (event.key === ",") {
      event.preventDefault();
      const before = draft.split(",")[0] ?? "";
      if (commitDraft(before)) {
        const rest = draft.slice(before.length + 1);
        setDraft(rest.trimStart());
      }
    }

    if (event.key === "Backspace" && !draft && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="min-h-9 rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 shadow-sm focus-within:border-[#0b1220]/30 focus-within:ring-2 focus-within:ring-[#0b1220]/10">
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((item, index) => (
            <span key={`${item}-${index}`} className={chipClass}>
              <span className="truncate">{item}</span>
              <button
                type="button"
                onClick={() => removeChip(index)}
                className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <input
            id={inputId}
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setMessage(null);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (draft.trim()) commitDraft(draft);
            }}
            placeholder={
              chips.length === 0
                ? "e.g. Lunch break 12:30–1:30pm — press Enter or comma to add"
                : "Add another…"
            }
            className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-[#0b1220] outline-none placeholder:text-slate-400"
            aria-describedby={message ? `${inputId}-hint` : undefined}
          />
        </div>
      </div>
      {message ? (
        <p id={`${inputId}-hint`} className="text-[12.5px] text-amber-900">
          {message}
        </p>
      ) : (
        <p className="text-[12px] text-slate-500">
          Press Enter or comma after each break or exception.
        </p>
      )}
    </div>
  );
}
