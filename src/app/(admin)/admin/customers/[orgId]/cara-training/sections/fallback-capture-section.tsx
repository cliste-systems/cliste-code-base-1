"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DetailsCollectMode } from "@/lib/details-collect-mode";
import { buildDetailsCollectionPromptSection } from "@/lib/details-collect-mode";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";

import {
  saveCaraTrainingFallback,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function FallbackCaptureSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const collectItems = parseAgentKnowledgeList(data.agentDetailsToCollect);
  const preview = buildDetailsCollectionPromptSection(
    collectItems,
    data.detailsCollectMode,
  );

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingFallback(data.organizationId, {
        agentDetailsToCollect: data.agentDetailsToCollect,
        detailsCollectMode: data.detailsCollectMode,
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
      title="8. When Cara can't answer"
      description="What Cara collects before creating an action ticket."
    >
      <div className="space-y-2">
        <Label>Details to collect (comma or newline separated)</Label>
        <Textarea
          value={data.agentDetailsToCollect}
          onChange={(e) => onChange({ agentDetailsToCollect: e.target.value })}
          rows={3}
          placeholder="Name, callback number, order reference"
        />
      </div>
      <div className="space-y-2">
        <Label>Collection mode</Label>
        <select
          className="border-input bg-background flex h-9 w-full max-w-xs rounded-md border px-3 text-sm"
          value={data.detailsCollectMode}
          onChange={(e) =>
            onChange({
              detailsCollectMode: e.target.value as DetailsCollectMode,
            })
          }
        >
          <option value="conversational">Conversational</option>
          <option value="fixed">Fixed order</option>
        </select>
      </div>
      {preview ? (
        <pre className="max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
          {preview}
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save fallback capture"}
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
