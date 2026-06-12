"use client";

import { CaraSetupChipEditor } from "@/components/agent-knowledge/cara-setup-chip-editor";
import { dedupeCaraSetupChips } from "@/lib/cara-setup-chips";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  inputId: string;
  placeholder?: string;
  maxItems?: number;
};

export function RouteKeywordsChipEditor({
  value,
  onChange,
  inputId,
  placeholder = "e.g. book an appointment",
  maxItems = 20,
}: Props) {
  return (
    <CaraSetupChipEditor
      inputId={inputId}
      placeholder={placeholder}
      value={value}
      maxItems={maxItems}
      onChange={(next) => onChange(dedupeCaraSetupChips(next))}
      beforeAdd={() => ({ outcome: "allow" })}
    />
  );
}

/** Merge Setup services into existing keyword chips (deduped). */
export function mergeRouteKeywordsFromServices(
  current: string[],
  servicesOffered: string[],
  maxItems = 20,
): string[] {
  return dedupeCaraSetupChips([...current, ...servicesOffered]).slice(0, maxItems);
}
