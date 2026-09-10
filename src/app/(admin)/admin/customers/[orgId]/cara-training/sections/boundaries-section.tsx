"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CaraTrainingField } from "@/components/admin/cara-training-field";
import { CaraTrainingSectionFooter } from "@/components/admin/cara-training-feedback";
import { Textarea } from "@/components/ui/textarea";
import {
  RETAIL_ALLERGEN_INSTRUCTION,
  RETAIL_AGE_RESTRICTED_INSTRUCTION,
  RETAIL_LIVE_STOCK_PRICE_INSTRUCTION,
  RETAIL_NO_MEDICAL_LEGAL_FINANCIAL_INSTRUCTION,
} from "@/lib/retail-prompt-boundaries";

import {
  saveCaraTrainingBoundaries,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function BoundariesSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingBoundaries(data.organizationId, {
        agentServicesNotOffered: data.agentServicesNotOffered,
        agentExtraNotes: data.agentExtraNotes,
        agentBusinessRules: data.agentBusinessRules,
        agentCaraRules: data.agentCaraRules,
        agentCaraConduct: data.agentCaraConduct,
        quotePricesOnCalls: data.quotePricesOnCalls,
        blockAnonymousCallers: data.blockAnonymousCallers,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data, onSaved]);

  return (
    <SectionCard
      title="6. Boundaries"
      description="Retail guardrails, services not offered, and conduct rules."
    >
      <CaraTrainingField
        label="Retail guardrails"
        feed="prompt"
        hint="Always included for managed retail stores."
      >
        <ul className="space-y-1 text-xs text-slate-700">
          <li>{RETAIL_LIVE_STOCK_PRICE_INSTRUCTION}</li>
          <li>{RETAIL_AGE_RESTRICTED_INSTRUCTION}</li>
          <li>{RETAIL_ALLERGEN_INSTRUCTION}</li>
          <li>{RETAIL_NO_MEDICAL_LEGAL_FINANCIAL_INSTRUCTION}</li>
        </ul>
      </CaraTrainingField>
      <CaraTrainingField label="Services not offered" feed="prompt">
        <Textarea
          value={data.agentServicesNotOffered}
          onChange={(e) => onChange({ agentServicesNotOffered: e.target.value })}
          rows={2}
        />
      </CaraTrainingField>
      <CaraTrainingField label="Extra notes" feed="prompt">
        <Textarea
          value={data.agentExtraNotes}
          onChange={(e) => onChange({ agentExtraNotes: e.target.value })}
          rows={3}
        />
      </CaraTrainingField>
      <CaraTrainingField label="Business rules (one per line)" feed="prompt">
        <Textarea
          value={data.agentBusinessRules.join("\n")}
          onChange={(e) =>
            onChange({
              agentBusinessRules: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            })
          }
          rows={3}
        />
      </CaraTrainingField>
      <CaraTrainingField label="Cara conduct" feed="prompt">
        <Textarea
          value={data.agentCaraConduct}
          onChange={(e) => onChange({ agentCaraConduct: e.target.value })}
          rows={2}
        />
      </CaraTrainingField>
      <CaraTrainingField
        label="Quote prices on calls when known"
        feed="prompt"
        hint="Explicit choice — changes whether Cara may quote prices from her knowledge."
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.quotePricesOnCalls}
            onChange={(e) => onChange({ quotePricesOnCalls: e.target.checked })}
          />
          Allow price quotes when the answer is in her knowledge
        </label>
      </CaraTrainingField>
      <CaraTrainingField
        label="Block anonymous callers"
        feed="behaviour"
        hint="Call handling rule — not spoken to callers."
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.blockAnonymousCallers}
            onChange={(e) => onChange({ blockAnonymousCallers: e.target.checked })}
          />
          Reject calls with hidden caller ID
        </label>
      </CaraTrainingField>
      <CaraTrainingSectionFooter saved={saved} error={error}>
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save boundaries"}
        </Button>
      </CaraTrainingSectionFooter>
    </SectionCard>
  );
}
