"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import {
  type DayPickerProps,
  DayPicker,
  getDefaultClassNames,
} from "react-day-picker";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export type CalendarProps = DayPickerProps;

/**
 * Single-month calendar aligned with dashboard UI (gray-900 selection, soft grid).
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <div
      className={cn(
        "booking-calendar-root rounded-xl p-1",
        "[&_.rdp-root]:[--rdp-accent-color:theme(colors.gray.900)]",
        "[&_.rdp-root]:[--rdp-accent-background-color:theme(colors.gray.100)]",
        "[&_.rdp-root]:[--rdp-day-height:2.25rem] [&_.rdp-root]:[--rdp-day-width:2.25rem]",
        "[&_.rdp-root]:[--rdp-day_button-height:2.25rem] [&_.rdp-root]:[--rdp-day_button-width:2.25rem]",
        "[&_.rdp-root]:[--rdp-day_button-border-radius:0.5rem]",
      )}
    >
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("w-fit", className)}
        classNames={{
          ...defaults,
          ...classNames,
          root: cn(defaults.root, "font-sans text-gray-900"),
          months: cn(defaults.months, "flex flex-col gap-2"),
          month: cn(defaults.month, "gap-3"),
          month_caption: cn(
            defaults.month_caption,
            "mb-1 flex h-9 items-center justify-center px-1",
          ),
          caption_label: cn(
            defaults.caption_label,
            "text-sm font-semibold tracking-tight text-gray-900",
          ),
          nav: cn(defaults.nav, "absolute inset-x-1 top-1 flex items-center justify-between"),
          button_previous: cn(
            defaults.button_previous,
            "inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50",
          ),
          button_next: cn(
            defaults.button_next,
            "inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50",
          ),
          weekdays: cn(defaults.weekdays, "flex gap-0"),
          weekday: cn(
            defaults.weekday,
            "w-9 text-center text-[0.65rem] font-medium tracking-wider text-gray-400 uppercase",
          ),
          weeks: cn(defaults.weeks, "mt-1"),
          week: cn(defaults.week, "mt-1 flex w-full gap-0"),
          day: cn(defaults.day, "p-0"),
          day_button: cn(
            defaults.day_button,
            "size-9 rounded-lg text-sm font-medium text-gray-900",
            "hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:outline-none",
          ),
          selected: cn(defaults.selected, "[&_button]:bg-gray-900 [&_button]:text-white [&_button]:hover:bg-gray-800"),
          today: cn(defaults.today, "[&_button]:ring-1 [&_button]:ring-gray-300 [&_button]:ring-inset"),
          outside: cn(defaults.outside, "text-gray-300 opacity-70"),
          disabled: cn(defaults.disabled, "text-gray-300 opacity-40"),
          hidden: cn(defaults.hidden, "invisible"),
        }}
        components={{
          Chevron: ({ className: chClass, orientation }) => {
            const c = cn("size-4", chClass);
            if (orientation === "left") {
              return <ChevronLeft className={c} aria-hidden />;
            }
            if (orientation === "right") {
              return <ChevronRight className={c} aria-hidden />;
            }
            if (orientation === "up") {
              return <ChevronUp className={c} aria-hidden />;
            }
            return <ChevronDown className={c} aria-hidden />;
          },
        }}
        {...props}
      />
    </div>
  );
}

export { Calendar };
