"use client";

import { Lock, Plus, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import type { CaraGoal } from "@/lib/cara-goal";
import { cn } from "@/lib/utils";

import {
  CAPTURE_REQUIRED_FIELDS,
  captureOptionsForGoal,
  createCustomCaptureField,
  ensureRequiredCaptureFields,
  isCaptureOptionSelected,
  toggleCaptureOption,
  type CaraCaptureField,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";

const COMPACT_INPUT_CLASS =
  "h-10 min-w-0 flex-1 rounded-lg border border-slate-200/90 bg-white px-3 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 disabled:opacity-50";

const CHIP_WIDTH_CENTERED = "w-[calc(50%-0.25rem)] max-w-[11rem]";

type CaptureFieldsChipEditorProps = {
  captureFields: CaraCaptureField[];
  onCaptureFieldsChange: (fields: CaraCaptureField[]) => void;
  businessType: string;
  niche: string;
  caraGoal?: CaraGoal;
  disabled?: boolean;
  className?: string;
};

function LockedCaptureChip({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-slate-300",
        "bg-slate-100/90 px-3 py-2 text-[12.5px] font-medium text-slate-600",
      )}
      aria-label={`${label} — always collected`}
    >
      <Lock className="size-3 shrink-0 text-slate-400" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

function CaptureChip({
  label,
  selected,
  hint,
  onToggle,
  disabled,
  className,
}: {
  label: string;
  selected: boolean;
  hint?: string;
  onToggle?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      title={hint}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-full border px-3 py-2 text-[12.5px] transition-colors",
        selected
          ? "border-[#0b1220]/20 bg-[#0b1220] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function isLastOddGridItem(index: number, total: number): boolean {
  return total % 2 === 1 && index === total - 1;
}

function GridChipCell({
  index,
  total,
  children,
}: {
  index: number;
  total: number;
  children: ReactNode;
}) {
  if (!isLastOddGridItem(index, total)) {
    return <>{children}</>;
  }
  return <div className="col-span-2 flex justify-center">{children}</div>;
}

export function CaptureFieldsChipEditor({
  captureFields,
  onCaptureFieldsChange,
  businessType,
  niche,
  caraGoal,
  disabled = false,
  className,
}: CaptureFieldsChipEditorProps) {
  const customInputId = useId();
  const [customDraft, setCustomDraft] = useState("");

  const optionalOptions = captureOptionsForGoal(
    businessType,
    niche,
    caraGoal,
  );
  const customFields = captureFields.filter(
    (field) =>
      field.custom === true ||
      (field.id.startsWith("custom_") &&
        !optionalOptions.some((option) => option.id === field.id)),
  );

  const gridItemCount = optionalOptions.length + customFields.length;
  const customStartIndex = optionalOptions.length;

  function addCustomField() {
    const field = createCustomCaptureField(customDraft);
    if (!field) return;
    if (captureFields.some((existing) => existing.id === field.id)) {
      setCustomDraft("");
      return;
    }
    onCaptureFieldsChange(ensureRequiredCaptureFields([...captureFields, field]));
    setCustomDraft("");
  }

  function removeCustomField(id: string) {
    onCaptureFieldsChange(
      ensureRequiredCaptureFields(
        captureFields.filter((field) => field.id !== id),
      ),
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 gap-2">
        {CAPTURE_REQUIRED_FIELDS.map((field) => (
          <LockedCaptureChip key={field.id} label={field.label} />
        ))}

        {optionalOptions.map((option, index) => {
          const selected = isCaptureOptionSelected(captureFields, option.id);
          const centered = isLastOddGridItem(index, gridItemCount);
          return (
            <GridChipCell key={option.id} index={index} total={gridItemCount}>
              <CaptureChip
                label={option.label}
                hint={option.hint}
                selected={selected}
                disabled={disabled}
                className={centered ? CHIP_WIDTH_CENTERED : undefined}
                onToggle={() =>
                  onCaptureFieldsChange(
                    toggleCaptureOption(captureFields, option, !selected),
                  )
                }
              />
            </GridChipCell>
          );
        })}

        {customFields.map((field, index) => {
          const gridIndex = customStartIndex + index;
          const centered = isLastOddGridItem(gridIndex, gridItemCount);
          return (
            <GridChipCell key={field.id} index={gridIndex} total={gridItemCount}>
              <div
                className={cn(
                  "flex items-center gap-1",
                  centered ? CHIP_WIDTH_CENTERED : "w-full",
                )}
              >
                <span
                  className={cn(
                    "inline-flex min-w-0 flex-1 items-center justify-center rounded-full border px-2 py-2 text-center text-[12.5px]",
                    "border-[#0b1220]/20 bg-[#0b1220] text-white",
                  )}
                >
                  <span className="truncate">{field.label}</span>
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeCustomField(field.id)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  aria-label={`Remove ${field.label}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </GridChipCell>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          id={customInputId}
          type="text"
          value={customDraft}
          disabled={disabled}
          placeholder="Add something else…"
          onChange={(event) => setCustomDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomField();
            }
          }}
          className={COMPACT_INPUT_CLASS}
        />
        <button
          type="button"
          disabled={disabled || customDraft.trim().length < 2}
          onClick={addCustomField}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          Add
        </button>
      </div>
    </div>
  );
}
