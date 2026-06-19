"use client";

import { CaptureFieldsChipEditor } from "@/components/agent-knowledge/capture-fields-chip-editor";
import type { CaraGoal } from "@/lib/cara-goal";
import { cn } from "@/lib/utils";

import { CaraTrainingStepShell } from "./cara-training-step-shell";
import type { CaraCaptureField } from "./train-cara-capture-fields";

const CAPTURE_CONTENT_WIDTH = "mx-auto w-full max-w-md";

type Props = {
  title: string;
  subtitle: string;
  helper: string;
  captureFields: CaraCaptureField[];
  onCaptureFieldsChange: (fields: CaraCaptureField[]) => void;
  businessType: string;
  niche: string;
  caraGoal: CaraGoal;
  disabled?: boolean;
};

export function TrainCaraCaptureStep({
  title,
  subtitle,
  helper,
  captureFields,
  onCaptureFieldsChange,
  businessType,
  niche,
  caraGoal,
  disabled = false,
}: Props) {
  return (
    <CaraTrainingStepShell title={title} subtitle={subtitle} helper={helper} compact>
      <CaptureFieldsChipEditor
        className={cn(CAPTURE_CONTENT_WIDTH)}
        captureFields={captureFields}
        onCaptureFieldsChange={onCaptureFieldsChange}
        businessType={businessType}
        niche={niche}
        caraGoal={caraGoal}
        disabled={disabled}
      />
    </CaraTrainingStepShell>
  );
}
