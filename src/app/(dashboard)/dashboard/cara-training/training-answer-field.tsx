"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { CaraTrainingListItem } from "./cara-training-helpers";
import {
  trainingAnswerHelperText,
  trainingAnswerPlaceholder,
  trainingItemIsDeferred,
} from "./cara-training-helpers";
import {
  TRAINING_ANSWER_FIELD_ROWS,
  TRAINING_ANSWER_HELPER_CLASS,
  trainingAnswerTextareaClassName,
} from "./training-answer-field-styles";

type TrainingAnswerFieldProps = {
  item: CaraTrainingListItem;
  value: string;
  onChange: (value: string) => void;
};

export function TrainingAnswerField({
  item,
  value,
  onChange,
}: TrainingAnswerFieldProps) {
  const deferred = trainingItemIsDeferred(item);
  const helper = trainingAnswerHelperText(item);
  const placeholder = trainingAnswerPlaceholder(item);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <p className="text-[13px] font-semibold text-[#11181d]">Your answer</p>
        <p
          className={cn(
            TRAINING_ANSWER_HELPER_CLASS,
            deferred ? "text-amber-800/85" : "text-[#6b7c75]",
          )}
        >
          {helper}
        </p>
      </div>
      <Textarea
        value={deferred ? "" : value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={deferred}
        disabled={deferred}
        placeholder={placeholder}
        rows={TRAINING_ANSWER_FIELD_ROWS}
        autoComplete="off"
        spellCheck
        aria-disabled={deferred || undefined}
        className={trainingAnswerTextareaClassName(!deferred)}
      />
    </div>
  );
}
