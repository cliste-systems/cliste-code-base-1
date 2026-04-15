"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  type UpdateTenantAIConfigResult,
  updateTenantAIConfig,
} from "../../actions";

type AIBrainConfigFormProps = {
  organizationId: string;
  greeting: string | null;
  customPrompt: string | null;
};

export function AIBrainConfigForm({
  organizationId,
  greeting,
  customPrompt,
}: AIBrainConfigFormProps) {
  const [greetingValue, setGreetingValue] = useState(() => greeting ?? "");
  const [customPromptValue, setCustomPromptValue] = useState(
    () => customPrompt ?? ""
  );

  useEffect(() => {
    setGreetingValue(greeting ?? "");
    setCustomPromptValue(customPrompt ?? "");
  }, [organizationId, greeting, customPrompt]);

  const [state, formAction, isPending] = useActionState<
    UpdateTenantAIConfigResult | null,
    FormData
  >(
    async (_prev, formData) => updateTenantAIConfig(organizationId, formData),
    null
  );

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">AI Brain Configuration</CardTitle>
        <CardDescription>
          These instructions are injected directly into the LiveKit Voice Worker
          every time the phone rings. After each call, the worker must POST to{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            /api/voice/call-complete
          </code>{" "}
          (see env <code className="font-mono text-xs">CLISTE_VOICE_WEBHOOK_SECRET</code>)
          so Call history and AI bookings stay in sync.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="greeting">Opening Line</Label>
            <Input
              id="greeting"
              name="greeting"
              type="text"
              placeholder="Hi, thanks for calling Bella Salon..."
              value={greetingValue}
              onChange={(e) => setGreetingValue(e.target.value)}
              readOnly={isPending}
              aria-busy={isPending}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_prompt">System Instructions</Label>
            <Textarea
              id="custom_prompt"
              name="custom_prompt"
              rows={8}
              placeholder="You are a bubbly receptionist. Never mention competitors. Always ask for a phone number..."
              value={customPromptValue}
              onChange={(e) => setCustomPromptValue(e.target.value)}
              readOnly={isPending}
              aria-busy={isPending}
              className="min-h-[12rem] resize-y"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save AI Brain"}
            </Button>
            {state?.ok ? (
              <p
                className="text-emerald-700 dark:text-emerald-400 text-sm font-medium"
                role="status"
              >
                Saved to the database. You can leave this page or keep editing.
              </p>
            ) : null}
            {state && !state.ok ? (
              <p className="text-destructive text-sm" role="alert">
                {state.message}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
