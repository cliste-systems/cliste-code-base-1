"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { setOrganizationLive } from "../../actions";

export function GoLiveCard({
  organizationId,
  isActive,
  readyForGoLive,
  missingStepLabel,
}: {
  organizationId: string;
  isActive: boolean;
  readyForGoLive: boolean;
  missingStepLabel: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Go live</h2>
      <p className="mt-1 text-sm text-slate-600">
        When live, Cara answers inbound calls on the Cliste number. Setting{" "}
        <code className="text-xs">is_active = false</code> makes the voice
        worker refuse calls.
      </p>
      <p className="mt-2 text-sm">
        Status:{" "}
        <strong>{isActive ? "Live (accepting calls)" : "Offline"}</strong>
      </p>
      {!readyForGoLive && missingStepLabel ? (
        <p className="mt-2 text-sm text-amber-800">
          Complete <strong>{missingStepLabel}</strong> before going live.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || isActive || !readyForGoLive}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await setOrganizationLive(organizationId, true);
              setMsg(r.ok ? "Store is live." : r.message);
            });
          }}
        >
          {pending ? "Updating…" : "Go live"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !isActive}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await setOrganizationLive(organizationId, false);
              setMsg(r.ok ? "Store taken offline." : r.message);
            });
          }}
        >
          Take offline
        </Button>
      </div>
      {msg ? (
        <p
          className={
            msg.includes("live") || msg.includes("offline")
              ? "mt-2 text-sm font-medium text-emerald-700"
              : "text-destructive mt-2 text-sm"
          }
        >
          {msg}
        </p>
      ) : null}
    </section>
  );
}
