"use client";

import { useState, useTransition } from "react";
import { Radio } from "lucide-react";

import { cn } from "@/lib/utils";

import { toggleCaraActive } from "./settings/actions";

type DashboardCaraActiveToggleProps = {
  initialActive: boolean;
  /** Hero panel: lighter control on silver gradient background. */
  variant?: "default" | "hero";
};

const OPTIONS = [
  { value: true, label: "On" },
  { value: false, label: "Off" },
] as const;

export function DashboardCaraActiveToggle({
  initialActive,
  variant = "default",
}: DashboardCaraActiveToggleProps) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  function setCaraActive(next: boolean) {
    if (next === active || pending) return;
    setActive(next);
    startTransition(async () => {
      const result = await toggleCaraActive(next);
      if (!result.ok) {
        setActive(!next);
      }
    });
  }

  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "inline-flex h-[42px] shrink-0 items-center gap-2.5 rounded-xl border px-2.5",
        isHero
          ? active
            ? "border-slate-300/80 bg-white/90"
            : "border-white/60 bg-white/70"
          : active
            ? "border-slate-300 bg-slate-100/70"
            : "border-slate-200 bg-slate-50/90",
      )}
      role="group"
      aria-label="Cara line"
    >
      <span className="inline-flex min-w-0 items-center gap-2 pl-0.5">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border",
            active
              ? "border-slate-300/90 bg-white text-[#0b1220]"
              : "border-slate-200/80 bg-white text-slate-500",
          )}
          aria-hidden
        >
          <Radio className="size-3.5" strokeWidth={2.25} />
        </span>
        <span className="flex min-w-0 flex-col leading-none">
          <span className="text-[13px] font-semibold tracking-tight text-[#0b1220]">
            Cara
          </span>
          <span
            className={cn(
              "mt-0.5 hidden text-[10px] font-medium sm:block",
              active ? "text-slate-600" : "text-slate-500",
            )}
          >
            {active ? "Answering calls" : "Paused"}
          </span>
        </span>
      </span>

      <div
        className={cn(
          "inline-flex shrink-0 rounded-lg border p-0.5",
          isHero
            ? "border-slate-200/80 bg-white/90"
            : "border-slate-200/90 bg-white",
        )}
        role="presentation"
      >
        {OPTIONS.map(({ value, label }) => {
          const selected = active === value;
          const isOn = value === true;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setCaraActive(value)}
              disabled={pending}
              aria-pressed={selected}
              className={cn(
                "h-7 min-w-[2.25rem] rounded-md px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed",
                selected
                  ? isOn
                    ? "bg-[#0b1220] text-white shadow-sm"
                    : "bg-slate-200 text-slate-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-[#0b1220]",
                pending && "opacity-70",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
