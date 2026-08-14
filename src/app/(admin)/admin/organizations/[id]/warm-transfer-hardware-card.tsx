"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  WARM_TRANSFER_HARDWARE_STATUSES,
  type WarmTransferHardwareStatus,
} from "@/lib/admin-store-health";
import { cn } from "@/lib/utils";

import { updateWarmTransferHardware } from "../../actions";

const STATUS_LABEL: Record<WarmTransferHardwareStatus, string> = {
  go: "Go — handset can hold, enquire, and transfer",
  no_go: "No-go — hardware cannot warm-transfer",
  unknown: "Not checked yet",
};

export function WarmTransferHardwareCard({
  organizationId,
  initialStatus,
  initialNotes,
  computedLabel,
  computedReasons,
}: {
  organizationId: string;
  initialStatus: WarmTransferHardwareStatus;
  initialNotes: string;
  computedLabel: "Go" | "No-go";
  computedReasons: string[];
}) {
  const [status, setStatus] = useState<WarmTransferHardwareStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Warm-transfer go/no-go</CardTitle>
        <CardDescription>
          Hardware check plus DID, routing, and transfer number. Warm transfer
          only works when callers dial the Cliste number (not when the store
          forwards its own line).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            computedLabel === "Go"
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-amber-200 bg-amber-50/70",
          )}
        >
          <p className="text-xs font-medium tracking-wider uppercase">
            Combined verdict
          </p>
          <p className="mt-1 text-lg font-semibold">{computedLabel}</p>
          {computedReasons.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
              {computedReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-700">
              DID assigned, Cliste-number routing, transfer number, and hardware
              all ready.
            </p>
          )}
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            startTransition(async () => {
              const r = await updateWarmTransferHardware(organizationId, {
                status,
                notes,
              });
              setMsg(r.ok ? "Saved." : r.message);
            });
          }}
        >
          <div className="space-y-2">
            <Label>Handset / PBX</Label>
            <div className="space-y-1.5">
              {WARM_TRANSFER_HARDWARE_STATUSES.map((id) => (
                <label
                  key={id}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="warm-transfer-hardware"
                    className="mt-0.5"
                    checked={status === id}
                    onChange={() => setStatus(id)}
                  />
                  {STATUS_LABEL[id]}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="warm-transfer-notes">Hardware notes</Label>
            <Textarea
              id="warm-transfer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Analog cordless — enquiry hold works; transfer to Cara DID confirmed."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save hardware check"}
            </Button>
            {msg ? (
              <p className="text-muted-foreground text-sm">{msg}</p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
