"use client";

import { CaraTrainingStepShell, TRAINING_TEXTAREA } from "./cara-training-step-shell";
import type { ExclusionsStepCopy } from "./train-cara-services-copy";
import { cn } from "@/lib/utils";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";

type Props = {
  title: string;
  subtitle: string;
  exclusionsCopy: ExclusionsStepCopy;
  servicesNotOfferedRaw: string;
  servicesNotOffered: string;
  onServicesNotOfferedRawChange: (value: string) => void;
  disabled?: boolean;
};

function ChipPreview({ label, chips }: { label: string; chips: string[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-slate-400">
        {label}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[12px] text-slate-700"
          >
            {chip}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrainCaraExclusionsStep({
  title,
  subtitle,
  exclusionsCopy,
  servicesNotOfferedRaw,
  servicesNotOffered,
  onServicesNotOfferedRawChange,
  disabled = false,
}: Props) {
  const savedChips = parseAgentKnowledgeList(servicesNotOffered);
  const showSavedPreview =
    savedChips.length > 0 && !servicesNotOfferedRaw.trim();

  return (
    <CaraTrainingStepShell title={title} subtitle={subtitle} compact>
      <div className="w-full space-y-3">
        <div className="space-y-1.5">
          <textarea
            value={servicesNotOfferedRaw}
            disabled={disabled}
            placeholder={exclusionsCopy.placeholder}
            aria-label="Services not offered"
            onChange={(event) => onServicesNotOfferedRawChange(event.target.value)}
            className={cn(
              TRAINING_TEXTAREA,
              "max-h-[min(12rem,32vh)] min-h-[6rem] resize-none",
            )}
          />
          {exclusionsCopy.helper ? (
            <p className="text-center text-[11px] leading-relaxed text-slate-400">
              {exclusionsCopy.helper}
            </p>
          ) : null}
        </div>

        {showSavedPreview ? (
          <ChipPreview label={exclusionsCopy.previewLabel} chips={savedChips} />
        ) : null}
      </div>
    </CaraTrainingStepShell>
  );
}
