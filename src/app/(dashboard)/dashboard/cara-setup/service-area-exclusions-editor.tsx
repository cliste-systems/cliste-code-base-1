"use client";

import {
  CaraSetupChipEditor,
  type ChipBeforeAddResult,
} from "@/components/agent-knowledge/cara-setup-chip-editor";
import { dedupeCaraSetupChips } from "@/lib/cara-setup-chips";
import {
  findNearDuplicateServiceArea,
  serviceAreaChipTooLong,
} from "@/lib/service-area-boundary";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  inputId: string;
};

export function ServiceAreaExclusionsEditor({ value, onChange, inputId }: Props) {
  function beforeAdd(item: string): ChipBeforeAddResult {
    if (serviceAreaChipTooLong(item)) {
      return {
        outcome: "block",
        message: "Keep each exclusion short — one town or area per chip.",
      };
    }

    const nearDup = findNearDuplicateServiceArea(item, value);
    if (nearDup) {
      return {
        outcome: "allow",
        warn: `Looks similar to "${nearDup}" — check you need both.`,
      };
    }

    return { outcome: "allow" };
  }

  return (
    <CaraSetupChipEditor
      inputId={inputId}
      placeholder="Add a town to exclude"
      value={value}
      onChange={(next) => onChange(dedupeCaraSetupChips(next))}
      beforeAdd={beforeAdd}
    />
  );
}
