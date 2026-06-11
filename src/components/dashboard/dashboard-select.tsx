"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export type DashboardSelectOption<T extends string> = {
  value: T;
  label: string;
};

type DashboardSelectProps<T extends string> = {
  id?: string;
  value: T;
  options: readonly DashboardSelectOption<T>[];
  onValueChange: (value: T) => void;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export function DashboardSelect<T extends string>({
  id,
  value,
  options,
  onValueChange,
  invalid = false,
  placeholder = "Select…",
  className,
  "aria-label": ariaLabel,
}: DashboardSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const showPlaceholder = !value || !selected;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
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
      className={cn(
        "rounded-xl border bg-white shadow-sm",
        DASHBOARD_INPUT_CLASS,
        invalid && "border-red-400",
        open && "border-[#0b1220] ring-1 ring-[#0b1220]",
        className,
      )}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full cursor-pointer items-center justify-between gap-3 px-3 text-left text-[13px] text-[#0b1220] outline-none"
      >
        <span className="truncate">
          {showPlaceholder ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            selected?.label
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
          "grid border-t border-slate-100 transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className={cn("overflow-hidden", !open && "pointer-events-none")}>
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            aria-hidden={!open}
            className="max-h-48 overflow-y-auto overscroll-y-contain px-1 py-1"
          >
            {options
              .filter((option) => option.value !== "")
              .map((option) => {
                const isSelected = option.value === value;

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
                      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                      isSelected
                        ? "bg-slate-50 font-medium text-[#0b1220]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#0b1220]",
                    )}
                  >
                    <span>{option.label}</span>
                    <Check
                      className={cn(
                        "size-3.5 shrink-0 text-[#0b1220] transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      strokeWidth={2.5}
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
