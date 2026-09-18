"use client";

import type {
  TemporalDurationMode,
  TemporalEndChoice,
  TemporalReviewReminderChoice,
  TemporalStartChoice,
} from "@/lib/cara-knowledge-temporal";
import {
  buildTemporalWindow,
  formatTemporalWindowSummary,
  validateTemporalWindow,
} from "@/lib/cara-knowledge-temporal";
import { cn } from "@/lib/utils";
import { DASHBOARD_INPUT_CLASS, DASHBOARD_SELECT_CLASS } from "@/components/dashboard/dashboard-surface";

export type TeachTemporalDurationState = {
  durationMode: TemporalDurationMode;
  startChoice: TemporalStartChoice;
  startAt: string;
  endChoice: TemporalEndChoice;
  endAt: string;
  reviewReminderChoice: TemporalReviewReminderChoice;
};

export const DEFAULT_TEACH_TEMPORAL_DURATION: TeachTemporalDurationState = {
  durationMode: "standard",
  startChoice: "now",
  startAt: "",
  endChoice: "end_of_today",
  endAt: "",
  reviewReminderChoice: "none",
};

export function TeachTemporalDurationFields({
  value,
  onChange,
  timezone,
  idPrefix,
}: {
  value: TeachTemporalDurationState;
  onChange: (next: TeachTemporalDurationState) => void;
  timezone: string;
  idPrefix: string;
}) {
  const window =
    value.durationMode === "standard"
      ? null
      : buildTemporalWindow(
          {
            durationMode: value.durationMode,
            startChoice: value.startChoice,
            startAt: value.startAt || null,
            endChoice: value.endChoice,
            endAt: value.endAt || null,
            reviewReminderChoice: value.reviewReminderChoice,
          },
          timezone,
        );
  const validation =
    window && value.durationMode !== "standard"
      ? validateTemporalWindow(window, value.durationMode)
      : { ok: true as const };

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-[#11181d]">
          How long does this apply?
        </legend>
        {(
          [
            ["standard", "Until I change it — ordinary knowledge."],
            ["limited", "For a limited time — temporary or scheduled information."],
            ["ongoing", "Until I end it — ongoing disruptions with no confirmed end."],
          ] as const
        ).map(([mode, label]) => (
          <label
            key={mode}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#dfe7e2] bg-white px-3 py-2.5 text-[13px] text-[#35443f]"
          >
            <input
              type="radio"
              name={`${idPrefix}-duration-mode`}
              checked={value.durationMode === mode}
              onChange={() => onChange({ ...value, durationMode: mode })}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {value.durationMode === "limited" ? (
        <div className="space-y-4 rounded-lg border border-[#dfe7e2] bg-[#f8fafb] p-3">
          <fieldset className="space-y-2">
            <legend className="text-[12px] font-medium text-[#35443f]">Starts</legend>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="radio"
                checked={value.startChoice === "now"}
                onChange={() => onChange({ ...value, startChoice: "now" })}
              />
              Now
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="radio"
                checked={value.startChoice === "scheduled"}
                onChange={() => onChange({ ...value, startChoice: "scheduled" })}
              />
              Choose date and time
            </label>
            {value.startChoice === "scheduled" ? (
              <input
                type="datetime-local"
                value={value.startAt}
                onChange={(event) =>
                  onChange({ ...value, startAt: event.target.value })
                }
                className={cn(DASHBOARD_INPUT_CLASS, "h-10 w-full cursor-pointer px-3 text-[13px]")}
              />
            ) : null}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-[12px] font-medium text-[#35443f]">Ends</legend>
            {(
              [
                ["end_of_today", "End of today"],
                ["24h_after_start", "24 hours after the start"],
                ["scheduled", "Choose date and time"],
              ] as const
            ).map(([choice, label]) => (
              <label
                key={choice}
                className="flex cursor-pointer items-center gap-2 text-[13px]"
              >
                <input
                  type="radio"
                  checked={value.endChoice === choice}
                  onChange={() => onChange({ ...value, endChoice: choice })}
                />
                {label}
              </label>
            ))}
            {value.endChoice === "scheduled" ? (
              <input
                type="datetime-local"
                value={value.endAt}
                onChange={(event) =>
                  onChange({ ...value, endAt: event.target.value })
                }
                className={cn(DASHBOARD_INPUT_CLASS, "h-10 w-full cursor-pointer px-3 text-[13px]")}
              />
            ) : null}
          </fieldset>
        </div>
      ) : null}

      {value.durationMode === "ongoing" ? (
        <label className="block space-y-1.5">
          <span className="text-[12px] font-medium text-[#35443f]">
            Review reminder (optional)
          </span>
          <select
            value={value.reviewReminderChoice}
            onChange={(event) =>
              onChange({
                ...value,
                reviewReminderChoice: event.target
                  .value as TemporalReviewReminderChoice,
              })
            }
            className={cn(DASHBOARD_SELECT_CLASS, "cursor-pointer")}
          >
            <option value="none">No reminder</option>
            <option value="1d">Remind me in 1 day</option>
            <option value="3d">Remind me in 3 days</option>
            <option value="1w">Remind me in 1 week</option>
          </select>
          <p className="text-[11px] text-[#6b7c75]">
            A reminder helps you review this update. It will not end the disruption
            automatically.
          </p>
        </label>
      ) : null}

      {window && value.durationMode !== "standard" ? (
        <p className="text-[12px] text-[#6b7c75]">
          {formatTemporalWindowSummary(window, timezone)}
        </p>
      ) : null}

      {!validation.ok ? (
        <p className="text-[12px] text-red-700">{validation.message}</p>
      ) : null}
    </div>
  );
}

export function teachTemporalDurationIsValid(
  value: TeachTemporalDurationState,
  timezone: string,
): boolean {
  if (value.durationMode === "standard") return true;
  const window = buildTemporalWindow(
    {
      durationMode: value.durationMode,
      startChoice: value.startChoice,
      startAt: value.startAt || null,
      endChoice: value.endChoice,
      endAt: value.endAt || null,
      reviewReminderChoice: value.reviewReminderChoice,
    },
    timezone,
  );
  return validateTemporalWindow(window, value.durationMode).ok;
}
