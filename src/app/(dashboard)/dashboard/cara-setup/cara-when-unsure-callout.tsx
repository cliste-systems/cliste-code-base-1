import { Lock } from "lucide-react";

import { CARA_WHEN_UNSURE_LOCKED_COPY } from "@/lib/call-handling-boundary";

export const WHEN_UNSURE_COPY = CARA_WHEN_UNSURE_LOCKED_COPY;

export function CaraWhenUnsureCallout({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3.5"
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
          <Lock className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-semibold text-[#0b1220]">
            When Cara is unsure
          </p>
          <p className="text-[12.5px] leading-relaxed text-slate-600">
            {WHEN_UNSURE_COPY}
          </p>
          <p className="text-[11px] text-slate-500">
            This default cannot be changed — it keeps every call safe.
          </p>
        </div>
      </div>
    </div>
  );
}
