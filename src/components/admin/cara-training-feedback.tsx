import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";

import { cn } from "@/lib/utils";

const TONE_CLASS = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
} as const;

type FeedbackTone = keyof typeof TONE_CLASS;

export function CaraTrainingSavedBadge() {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE_CLASS.success,
      )}
      role="status"
    >
      <Check className="size-3.5 shrink-0" aria-hidden />
      Saved
    </span>
  );
}

export function CaraTrainingFeedback({
  tone,
  children,
  variant = "pill",
  className,
}: {
  tone: Exclude<FeedbackTone, "success">;
  children: ReactNode;
  variant?: "pill" | "block";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs leading-relaxed",
        variant === "pill"
          ? cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
              TONE_CLASS[tone],
            )
          : cn("rounded-md border px-2.5 py-1.5", TONE_CLASS[tone]),
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {variant === "pill" ? (
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      ) : null}
      {children}
    </p>
  );
}

export function CaraTrainingSectionFooter({
  children,
  saved,
  error,
}: {
  children: ReactNode;
  saved?: boolean;
  error?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {saved ? <CaraTrainingSavedBadge /> : null}
      {error ? (
        <CaraTrainingFeedback tone="error" variant="pill">
          {error}
        </CaraTrainingFeedback>
      ) : null}
    </div>
  );
}
