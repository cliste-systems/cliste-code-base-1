"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type OnboardingSelectOption<T extends string> = {
  value: T;
  label: string;
  /** Shown under the label in rich option rows. */
  description?: string;
  /** Small label above the title — helps separate similar options. */
  tagline?: string;
  icon?: LucideIcon;
  iconClassName?: string;
};

type OnboardingSelectProps<T extends string> = {
  id?: string;
  value: T;
  options: readonly OnboardingSelectOption<T>[];
  onValueChange: (value: T) => void;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
};

export function OnboardingSelect<T extends string>({
  id,
  value,
  options,
  onValueChange,
  invalid = false,
  placeholder = "Select…",
  className,
}: OnboardingSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const richOptions = options.some(
    (option) => option.description || option.tagline || option.icon,
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-state={open ? "open" : "closed"}
      className={cn("mt-1.5", className)}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-[15px] text-[#0b1220] shadow-none outline-none ring-0 focus-visible:ring-0",
          invalid && "text-red-700",
        )}
      >
        <span className="truncate">
          {selected?.label ?? (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className={cn("overflow-hidden", !open && "pointer-events-none")}>
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            aria-hidden={!open}
            className={cn(
              "border-t border-slate-100 pt-2",
              richOptions && "space-y-2",
            )}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              const isRich =
                richOptions &&
                (option.description || option.tagline || option.icon);
              const Icon = option.icon;

              if (isRich) {
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow]",
                      isSelected
                        ? "border-[#0b1220]/25 bg-[#0b1220]/[0.04] shadow-[0_4px_16px_rgba(15,23,42,0.06)] ring-1 ring-[#0b1220]/10"
                        : "border-slate-200/80 bg-slate-50/70 hover:border-slate-300 hover:bg-white",
                    )}
                  >
                    {Icon ? (
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                          option.iconClassName ??
                            "bg-slate-100 text-slate-600",
                        )}
                        aria-hidden
                      >
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      {option.tagline ? (
                        <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                          {option.tagline}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[15px] font-medium text-[#0b1220]">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-1 block text-[12px] leading-snug text-slate-600">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    <Check
                      className={cn(
                        "mt-1 size-4 shrink-0 text-[#0b1220]/50 transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </button>
                );
              }

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-0.5 py-2 text-left text-[15px] transition-colors",
                    isSelected
                      ? "font-medium text-[#0b1220]"
                      : "text-slate-600 hover:text-[#0b1220]",
                  )}
                >
                  <span>{option.label}</span>
                  <Check
                    className={cn(
                      "size-4 shrink-0 transition-opacity",
                      isSelected ? "text-slate-400 opacity-100" : "opacity-0",
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
