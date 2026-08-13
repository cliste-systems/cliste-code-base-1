"use client";

import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import type {
  BankHolidayConfig,
  WeekSchedule,
} from "@/lib/business-hours";
import { cn } from "@/lib/utils";

import {
  CaraTrainingStepShell,
  TRAINING_SURFACE,
} from "./cara-training-step-shell";
import { TrainCaraInlineNotice } from "./train-cara-inline-notice";

type Props = {
  title: string;
  subtitle: string;
  helper?: string;
  openingHoursSchedule: WeekSchedule;
  onOpeningHoursScheduleChange: (next: WeekSchedule) => void;
  open24_7: boolean;
  onOpen24_7Change: (next: boolean) => void;
  bankHolidays: BankHolidayConfig;
  onBankHolidaysChange: (next: BankHolidayConfig) => void;
  hoursNeverConfigured?: boolean;
  prefilledNotice?: string;
  disabled?: boolean;
};

export function TrainCaraHoursStep({
  title,
  subtitle,
  helper,
  openingHoursSchedule,
  onOpeningHoursScheduleChange,
  open24_7,
  onOpen24_7Change,
  bankHolidays,
  onBankHolidaysChange,
  hoursNeverConfigured = false,
  prefilledNotice,
  disabled = false,
}: Props) {
  return (
    <CaraTrainingStepShell
      title={title}
      subtitle={subtitle}
      helper={helper}
      compact
    >
      <div className={cn("w-full", TRAINING_SURFACE, "p-4 sm:p-5")}>
        <TrainCaraInlineNotice message={prefilledNotice} tone="brand" />
        <OpeningHoursEditor
          value={openingHoursSchedule}
          onChange={onOpeningHoursScheduleChange}
          open24_7={open24_7}
          onOpen24_7Change={onOpen24_7Change}
          bankHolidays={bankHolidays}
          onBankHolidaysChange={onBankHolidaysChange}
          hoursNeverConfigured={hoursNeverConfigured}
          embedded
          compact
          variant="dashboard"
          className={disabled ? "pointer-events-none opacity-60" : undefined}
        />
      </div>
    </CaraTrainingStepShell>
  );
}
