"use client";

import { cn } from "@/lib/utils";
import type { StoreSetupStepId, StoreSetupStepStatus } from "@/lib/admin-store-readiness";

type ReadinessRailProps = {
  steps: StoreSetupStepStatus[];
  activeStep: StoreSetupStepId;
  onSelect: (id: StoreSetupStepId) => void;
};

export function ReadinessRail({
  steps,
  activeStep,
  onSelect,
}: ReadinessRailProps) {
  const completeCount = steps.filter((s) => s.complete).length;

  return (
    <aside className="border-border bg-card sticky top-4 rounded-xl border p-4 shadow-sm">
      <div className="mb-4">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Setup progress
        </p>
        <p className="text-foreground mt-1 text-lg font-semibold">
          {completeCount} / {steps.length} steps
        </p>
      </div>
      <ol className="space-y-1">
        {steps.map((step, index) => {
          const active = step.id === activeStep;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    step.complete
                      ? "bg-emerald-600 text-white"
                      : "border-border text-muted-foreground border bg-background",
                  )}
                  aria-hidden
                >
                  {step.complete ? "✓" : index + 1}
                </span>
                <span>
                  <span className="text-foreground block font-medium">
                    {step.label}
                  </span>
                  <span className="text-muted-foreground block text-xs leading-snug">
                    {step.detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
