"use client";

import { useCallback, useState, useTransition } from "react";

import { CaraTrainingField } from "@/components/admin/cara-training-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformCaraRules } from "@/lib/platform-cara-rules-shared";
import { VOICE_LEGAL_NOTICE_HINT } from "@/lib/voice-greeting";

import { savePlatformCaraRulesAction } from "./actions";

function rulesToText(rules: string[]): string {
  return rules.join("\n");
}

function textToRules(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function PlatformRulesForm({
  initialRules,
}: {
  initialRules: PlatformCaraRules;
}) {
  const [rules, setRules] = useState(initialRules);
  const [behaviourText, setBehaviourText] = useState(
    rulesToText(initialRules.platformBehaviourRules),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = useCallback(() => {
    setError(null);
    setSuccess(null);
    const payload: PlatformCaraRules = {
      ...rules,
      platformBehaviourRules: textToRules(behaviourText),
    };
    startTransition(async () => {
      const result = await savePlatformCaraRulesAction(payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRules(payload);
      const parts = [
        `Updated ${result.regenerated} customer prompt${result.regenerated === 1 ? "" : "s"}.`,
      ];
      if (result.greetingsUpdated > 0) {
        parts.push(
          `${result.greetingsUpdated} greeting${result.greetingsUpdated === 1 ? "" : "s"} refreshed.`,
        );
      }
      if (result.failedCount > 0) {
        parts.push(`${result.failedCount} failed — check logs.`);
      }
      setSuccess(parts.join(" "));
    });
  }, [behaviourText, rules]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0b1220]">
          Editable platform rules
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          These apply to every customer on every call. Store owners cannot
          override them.
        </p>

        <div className="mt-6 space-y-6">
          <CaraTrainingField
            label="Caller disclosure template"
            feed="prompt"
            hint={`Use {assistant} for the assistant name. ${VOICE_LEGAL_NOTICE_HINT}`}
          >
            <Textarea
              value={rules.legalDisclosureTemplate}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  legalDisclosureTemplate: e.target.value,
                }))
              }
              rows={2}
            />
          </CaraTrainingField>

          <CaraTrainingField
            label="Platform behaviour rules"
            feed="prompt"
            hint="One rule per line — appended to the non-negotiables block."
          >
            <Textarea
              value={behaviourText}
              onChange={(e) => setBehaviourText(e.target.value)}
              rows={5}
              placeholder="If they ask for a human, don't argue — offer transfer or take a message."
            />
          </CaraTrainingField>

          <CaraTrainingField
            label="Transfer behaviour (when enabled)"
            feed="prompt"
          >
            <Textarea
              value={rules.transferWhenEnabled}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  transferWhenEnabled: e.target.value,
                }))
              }
              rows={3}
            />
          </CaraTrainingField>

          <CaraTrainingField
            label="Transfer behaviour (when disabled)"
            feed="prompt"
          >
            <Textarea
              value={rules.transferWhenDisabled}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  transferWhenDisabled: e.target.value,
                }))
              }
              rows={3}
            />
          </CaraTrainingField>

          <CaraTrainingField label="Routing protocol" feed="prompt">
            <Textarea
              value={rules.routingProtocol}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  routingProtocol: e.target.value,
                }))
              }
              rows={8}
            />
          </CaraTrainingField>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving and recompiling…" : "Save and apply to all customers"}
          </Button>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-emerald-800" role="status">
              {success}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
