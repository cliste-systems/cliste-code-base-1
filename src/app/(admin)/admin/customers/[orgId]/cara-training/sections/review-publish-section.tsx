"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  saveCaraTrainingAdminNotes,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function ReviewPublishSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const saveNotes = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingAdminNotes(
        data.organizationId,
        data.adminNotes,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data.adminNotes, data.organizationId, onSaved]);

  const warnings = Array.isArray(data.promptCompileWarnings)
    ? data.promptCompileWarnings
    : [];

  return (
    <SectionCard
      title="11. Review & publish"
      description="Internal notes never appear in the compiled prompt. Recompile happens on each section save."
    >
      <div className="space-y-2">
        <Label>Admin notes (internal only)</Label>
        <Textarea
          value={data.adminNotes}
          onChange={(e) => onChange({ adminNotes: e.target.value })}
          rows={3}
          placeholder="Provisioning notes, hardware quirks, escalation contacts…"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={saveNotes}>
          {pending ? "Saving…" : "Save admin notes"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
      </div>

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Compile warnings</p>
          <pre className="mt-1 overflow-auto text-xs">{JSON.stringify(warnings, null, 2)}</pre>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Compiled prompt</Label>
        <p className="text-muted-foreground text-xs">
          Read-only — updated when you save any section above.
        </p>
        <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
          {data.customPrompt || "— not compiled yet —"}
        </pre>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </SectionCard>
  );
}
