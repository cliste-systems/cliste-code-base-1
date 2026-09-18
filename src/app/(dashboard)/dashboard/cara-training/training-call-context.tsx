"use client";

import { DetailActionButton } from "@/components/dashboard/list-detail";
import { cn } from "@/lib/utils";

import {
  trainingCallFactSegments,
  type TrainingCallFacts,
} from "./cara-training-helpers";

type TrainingCallFactsBarProps = {
  callViewHref: string | null;
  callFacts: TrainingCallFacts | null;
};

export function TrainingCallFactsBar({
  callViewHref,
  callFacts,
}: TrainingCallFactsBarProps) {
  const factSegments = callFacts ? trainingCallFactSegments(callFacts) : [];
  if (factSegments.length === 0 && !callViewHref) return null;

  return (
    <div className="shrink-0 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7c75]">
            Call
          </p>
          {factSegments.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {factSegments.map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    "inline-flex items-center rounded-md border border-[#e2e8e4] bg-white px-2 py-0.5",
                    "text-[11px] font-medium leading-none text-[#475569] tabular-nums",
                  )}
                >
                  {segment}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {callViewHref ? (
          <DetailActionButton
            href={callViewHref}
            className="h-7 shrink-0 border-[#d9e2dd] bg-white px-2 text-[11px]"
          >
            View call
          </DetailActionButton>
        ) : null}
      </div>
    </div>
  );
}

type TrainingCallerExcerptProps = {
  excerpt: string | null;
};

export function TrainingCallerExcerpt({ excerpt }: TrainingCallerExcerptProps) {
  if (!excerpt?.trim()) return null;

  return (
    <div className="shrink-0 border-l-2 border-[#cbd5e1] pl-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#6b7c75]">
        What the caller asked
      </p>
      <p className="mt-1 line-clamp-3 text-[14px] leading-snug text-[#334155] [overflow-wrap:anywhere]">
        {excerpt}
      </p>
    </div>
  );
}
