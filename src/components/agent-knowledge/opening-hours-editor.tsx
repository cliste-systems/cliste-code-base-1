"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

import {
  DAY_KEYS,
  DAY_LABELS_SHORT,
  open24_7WeekSchedule,
  type DayKey,
  type WeekSchedule,
  weekScheduleHasOpenDay,
} from "@/lib/business-hours";
import { HOURS_NOTE_MAX_LENGTH } from "@/lib/general-boundary";
import { cn } from "@/lib/utils";

type Variant = "onboarding" | "dashboard";

type Props = {
  value: WeekSchedule;
  onChange: (next: WeekSchedule) => void;
  open24_7?: boolean;
  onOpen24_7Change?: (next: boolean) => void;
  hoursNote?: string;
  onHoursNoteChange?: (next: string) => void;
  hoursNeverConfigured?: boolean;
  variant?: Variant;
  className?: string;
};

const timeClass =
  "h-9 min-w-0 flex-1 rounded-lg border border-slate-200/90 bg-white px-2 text-[13px] text-[#0b1220] shadow-sm outline-none focus-visible:border-[#0b1220]/30 focus-visible:ring-2 focus-visible:ring-[#0b1220]/10";

export function OpeningHoursEditor({
  value,
  onChange,
  open24_7 = false,
  onOpen24_7Change,
  hoursNote = "",
  onHoursNoteChange,
  hoursNeverConfigured = false,
  variant = "onboarding",
  className,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<DayKey>("monday");
  const compact = variant === "onboarding";
  const selected = value[selectedDay];
  const noOpenDays = !open24_7 && !weekScheduleHasOpenDay(value);

  function updateDay(day: DayKey, patch: Partial<WeekSchedule[DayKey]>) {
    onChange({
      ...value,
      [day]: { ...value[day], ...patch },
    });
  }

  function copyMondayToWeekdays() {
    const monday = value.monday;
    onChange({
      ...value,
      tuesday: { ...monday },
      wednesday: { ...monday },
      thursday: { ...monday },
      friday: { ...monday },
    });
  }

  function toggle24_7(checked: boolean) {
    onOpen24_7Change?.(checked);
    if (checked) {
      onChange(open24_7WeekSchedule());
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-[12.5px] text-slate-700">
          <input
            type="checkbox"
            checked={open24_7}
            onChange={(event) => toggle24_7(event.target.checked)}
            className="size-4 rounded border-slate-300 text-[#0b1220]"
          />
          Open 24 hours, 7 days
        </label>
        {!open24_7 ? (
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-[#0b1220]",
              compact && "ml-auto",
            )}
          >
            <Copy className="size-3.5" aria-hidden />
            Copy Mon → Fri
          </button>
        ) : null}
      </div>

      {hoursNeverConfigured && noOpenDays ? (
        <p className="text-[12.5px] text-amber-900">
          No opening days set — Cara will tell callers she&apos;ll need to check
          opening times and take a message.
        </p>
      ) : null}

      {!open24_7 && noOpenDays && !hoursNeverConfigured ? (
        <p className="text-[12.5px] text-amber-900">
          No opening days set — Cara will tell callers you&apos;re closed all
          week.
        </p>
      ) : null}

      {!open24_7 ? (
        <>
          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Days of the week"
          >
            {DAY_KEYS.map((day) => {
              const active = selectedDay === day;
              const open = value[day].open;
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-[#0b1220] text-white"
                      : open
                        ? "border border-slate-200 bg-white text-[#0b1220]"
                        : "border border-slate-200/70 bg-slate-50 text-slate-500",
                  )}
                >
                  {DAY_LABELS_SHORT[day]}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-[13px] text-[#0b1220]">
                <input
                  type="checkbox"
                  checked={selected.open}
                  onChange={(event) =>
                    updateDay(selectedDay, { open: event.target.checked })
                  }
                  className="size-4 rounded border-slate-300 text-[#0b1220]"
                />
                Open on {DAY_LABELS_SHORT[selectedDay]}
              </label>
              {selected.open ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input
                    type="time"
                    value={selected.start}
                    onChange={(event) =>
                      updateDay(selectedDay, { start: event.target.value })
                    }
                    className={timeClass}
                    aria-label={`${DAY_LABELS_SHORT[selectedDay]} opens`}
                  />
                  <span className="shrink-0 text-[12px] text-slate-400">–</span>
                  <input
                    type="time"
                    value={selected.end}
                    onChange={(event) =>
                      updateDay(selectedDay, { end: event.target.value })
                    }
                    className={timeClass}
                    aria-label={`${DAY_LABELS_SHORT[selectedDay]} closes`}
                  />
                </div>
              ) : (
                <span className="text-[13px] text-slate-400">Closed</span>
              )}
            </div>
          </div>
        </>
      ) : null}

      {onHoursNoteChange ? (
        <div>
          <label
            htmlFor="hours-note"
            className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
          >
            Hours note
          </label>
          <input
            id="hours-note"
            type="text"
            value={hoursNote}
            maxLength={HOURS_NOTE_MAX_LENGTH}
            onChange={(event) => onHoursNoteChange(event.target.value)}
            placeholder="e.g. Closed bank holidays, By appointment only"
            className="h-9 w-full rounded-lg border border-slate-200/90 bg-white px-3 text-[13px] text-[#0b1220] shadow-sm outline-none focus-visible:border-[#0b1220]/30 focus-visible:ring-2 focus-visible:ring-[#0b1220]/10"
          />
        </div>
      ) : null}
    </div>
  );
}
