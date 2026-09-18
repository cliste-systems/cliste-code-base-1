import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

/** Fixed answer field height — active and deferred states must match exactly. */
export const TRAINING_ANSWER_TEXTAREA_HEIGHT_CLASS = "h-[100px]";

export const TRAINING_ANSWER_FIELD_ROWS = 3;

export const TRAINING_ANSWER_HELPER_CLASS =
  "mt-1 text-[12px] leading-snug";

export function trainingAnswerTextareaClassName(active: boolean): string {
  return cn(
    DASHBOARD_INPUT_CLASS,
    "mt-2 w-full shrink-0 resize-none text-[14px] leading-relaxed",
    TRAINING_ANSWER_TEXTAREA_HEIGHT_CLASS,
    active
      ? "bg-white"
      : "cursor-not-allowed border-amber-300 bg-amber-50 text-amber-950/75 shadow-none placeholder:text-amber-700/55 disabled:cursor-not-allowed disabled:opacity-100",
  );
}
