import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import type { CaraSetupStep } from "@/lib/dashboard-cara-setup-steps";
import { cn } from "@/lib/utils";

export function SetupChecklist({ steps }: { steps: CaraSetupStep[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {steps.map((step) => (
        <li key={step.id}>
          <Link
            href={step.href}
            className="flex items-center gap-2.5 py-1.5 text-[13px] text-slate-700 transition-colors hover:text-[#0b1220]"
          >
            {step.complete ? (
              <CheckCircle2
                className="size-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <Circle className="size-4 shrink-0 text-slate-300" aria-hidden />
            )}
            <span className={cn(step.complete && "text-slate-500")}>
              {step.label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SetupProgressBar({
  complete,
  total,
}: {
  complete: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={complete}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Setup progress: ${complete} of ${total} complete`}
    >
      <div
        className="h-full rounded-full bg-[#0b1220] transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
