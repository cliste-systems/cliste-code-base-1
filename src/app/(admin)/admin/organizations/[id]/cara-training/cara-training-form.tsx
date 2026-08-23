"use client";

import { useCallback, useState, useTransition } from "react";

import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { greetingDisclosesAi } from "@/lib/greeting-discloses-ai";
import { voiceLegalDisclosure } from "@/lib/voice-greeting";

import {
  saveCaraTraining,
  type CaraTrainingData,
} from "./cara-training-actions";

export function CaraTrainingForm({ initial }: { initial: CaraTrainingData }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const greetingPreview = [
    data.greetingIntro.trim(),
    voiceLegalDisclosure(data.assistantDisplayName),
    data.greetingClosing.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const greetingWarning = !greetingDisclosesAi(
    greetingPreview,
    data.assistantDisplayName,
  );

  const submit = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTraining(data.organizationId, {
        name: data.name,
        assistantDisplayName: data.assistantDisplayName,
        greetingIntro: data.greetingIntro,
        greetingClosing: data.greetingClosing,
        agentVoiceId: data.agentVoiceId,
        agentBusinessType: data.agentBusinessType,
        businessKnowledgeSummary: data.businessKnowledgeSummary,
        agentExtraNotes: data.agentExtraNotes,
        agentLocationAddress: data.agentLocationAddress,
        agentLocationEircode: data.agentLocationEircode,
        agentLocationCounty: data.agentLocationCounty,
        agentBaseTown: data.agentBaseTown,
        agentServicesDepartments: data.agentServicesDepartments,
        agentServicesNotOffered: data.agentServicesNotOffered,
        agentBusinessRules: data.agentBusinessRules,
        agentCaraRules: data.agentCaraRules,
        agentCaraConduct: data.agentCaraConduct,
        agentFaqs: data.agentFaqs,
        quotePricesOnCalls: data.quotePricesOnCalls,
        blockAnonymousCallers: data.blockAnonymousCallers,
        openingHoursSchedule: data.openingHoursSchedule,
        open24_7: data.open24_7,
        bankHolidays: data.bankHolidays,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
    });
  }, [data]);

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Greeting & voice</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Assistant name</Label>
            <Input
              value={data.assistantDisplayName}
              onChange={(e) =>
                setData((d) => ({ ...d, assistantDisplayName: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Voice ID (ElevenLabs)</Label>
            <Input
              value={data.agentVoiceId}
              onChange={(e) =>
                setData((d) => ({ ...d, agentVoiceId: e.target.value }))
              }
              className="font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Greeting intro</Label>
          <Input
            value={data.greetingIntro}
            onChange={(e) =>
              setData((d) => ({ ...d, greetingIntro: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Greeting closing</Label>
          <Input
            value={data.greetingClosing}
            onChange={(e) =>
              setData((d) => ({ ...d, greetingClosing: e.target.value }))
            }
          />
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {greetingPreview}
        </p>
        {greetingWarning ? (
          <p className="text-destructive text-sm" role="alert">
            Greeting must include AI and recording disclosure before go-live.
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Store knowledge</h2>
        <div className="space-y-2">
          <Label>Business type</Label>
          <Input
            value={data.agentBusinessType}
            onChange={(e) =>
              setData((d) => ({ ...d, agentBusinessType: e.target.value }))
            }
            placeholder="Supermarket"
          />
        </div>
        <div className="space-y-2">
          <Label>Knowledge summary</Label>
          <Textarea
            value={data.businessKnowledgeSummary}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                businessKnowledgeSummary: e.target.value,
              }))
            }
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Departments (comma-separated)</Label>
          <Textarea
            value={data.agentServicesDepartments}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                agentServicesDepartments: e.target.value,
              }))
            }
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Not offered</Label>
          <Textarea
            value={data.agentServicesNotOffered}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                agentServicesNotOffered: e.target.value,
              }))
            }
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Admin extra notes (compiled into prompt)</Label>
          <Textarea
            value={data.agentExtraNotes}
            onChange={(e) =>
              setData((d) => ({ ...d, agentExtraNotes: e.target.value }))
            }
            rows={3}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.quotePricesOnCalls}
            onChange={(e) =>
              setData((d) => ({ ...d, quotePricesOnCalls: e.target.checked }))
            }
          />
          Quote prices on calls when known
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.blockAnonymousCallers}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                blockAnonymousCallers: e.target.checked,
              }))
            }
          />
          Block anonymous callers
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Opening hours</h2>
        <OpeningHoursEditor
          value={data.openingHoursSchedule}
          onChange={(schedule) =>
            setData((d) => ({ ...d, openingHoursSchedule: schedule }))
          }
          open24_7={data.open24_7}
          onOpen24_7Change={(open24_7) => setData((d) => ({ ...d, open24_7 }))}
          bankHolidays={data.bankHolidays}
          onBankHolidaysChange={(bankHolidays) =>
            setData((d) => ({ ...d, bankHolidays }))
          }
        />
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Compiled prompt</h2>
        <p className="text-muted-foreground text-xs">
          Read-only — updated when you save. Owners cannot overwrite this from
          the dashboard agent setup.
        </p>
        <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
          {data.customPrompt || "— not compiled yet —"}
        </pre>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Saving…" : "Save & recompile prompt"}
        </Button>
        {saved ? (
          <p className="text-sm font-medium text-emerald-700">Saved.</p>
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
