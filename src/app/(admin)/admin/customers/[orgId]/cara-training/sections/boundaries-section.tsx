"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
      <ul className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <li>{RETAIL_LIVE_STOCK_PRICE_INSTRUCTION}</li>
        <li>{RETAIL_AGE_RESTRICTED_INSTRUCTION}</li>
        <li>{RETAIL_ALLERGEN_INSTRUCTION}</li>
        <li>{RETAIL_NO_MEDICAL_LEGAL_FINANCIAL_INSTRUCTION}</li>
      </ul>
      <div className="space-y-2">
        <Label>Services not offered</Label>
        <Textarea
          value={data.agentServicesNotOffered}
          onChange={(e) => onChange({ agentServicesNotOffered: e.target.value })}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Extra notes (compiled into prompt)</Label>
        <Textarea
          value={data.agentExtraNotes}
          onChange={(e) => onChange({ agentExtraNotes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Business rules (one per line)</Label>
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
      </div>
      <div className="space-y-2">
        <Label>Cara conduct</Label>
        <Textarea
          value={data.agentCaraConduct}
          onChange={(e) => onChange({ agentCaraConduct: e.target.value })}
          rows={2}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.quotePricesOnCalls}
          onChange={(e) => onChange({ quotePricesOnCalls: e.target.checked })}
        />
        Quote prices on calls when known (explicit choice required)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.blockAnonymousCallers}
          onChange={(e) => onChange({ blockAnonymousCallers: e.target.checked })}
        />
        Block anonymous callers
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save boundaries"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
