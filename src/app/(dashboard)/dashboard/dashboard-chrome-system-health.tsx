"use client";

import { Popover } from "@base-ui/react/popover";
import { useState } from "react";

import { cn } from "@/lib/utils";

const HEALTH_TRIGGER = cn(
  "inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full border border-[#e5eaf2] bg-white/80 px-2.5 text-[11px] font-semibold tracking-wide text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors",
  "hover:border-slate-300 hover:bg-white",
  "data-[popup-open]:border-slate-300 data-[popup-open]:bg-white",
);

const HEALTH_SCORE = 100;

const SUBSYSTEMS = [
  { id: "cara", label: "Cara voice agent" },
  { id: "calls", label: "Inbound calls" },
  { id: "routing", label: "Call routing" },
  { id: "dashboard", label: "Dashboard" },
  { id: "sms", label: "SMS delivery" },
] as const;

export function DashboardChromeSystemHealth() {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={HEALTH_TRIGGER}>
        All systems operational
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="z-[60] outline-none"
          side="bottom"
          align="end"
          sideOffset={8}
        >
          <Popover.Popup
            className={cn(
              "w-[min(calc(100vw-2rem),360px)] origin-[var(--transform-origin)] rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.28)] outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <div className="border-b border-slate-100 px-4 py-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                System health
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[28px] font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums">
                    {HEALTH_SCORE}%
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium text-[#0b1220]">
                    All systems operational
                  </p>
                </div>
                <p className="text-right text-[11px] leading-snug text-slate-400">
                  No active incidents
                </p>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={HEALTH_SCORE}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Platform health score"
              >
                <div
                  className="h-full rounded-full bg-[#0b1220] transition-[width] duration-300"
                  style={{ width: `${HEALTH_SCORE}%` }}
                />
              </div>
            </div>

            <ul className="divide-y divide-slate-100 px-4 py-1 pb-2">
              {SUBSYSTEMS.map((subsystem) => (
                <li
                  key={subsystem.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="text-[13px] text-[#0b1220]">
                    {subsystem.label}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-slate-500">
                    Operational
                  </span>
                </li>
              ))}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
