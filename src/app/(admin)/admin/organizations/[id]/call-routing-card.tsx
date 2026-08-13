"use client";

import { useMemo, useState, useTransition } from "react";

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
import {
  CALL_ROUTING_MODE_META,
  CALL_ROUTING_MODES,
  CANCEL_ALL_FORWARDING_CODE,
  forwardingCodesForMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { cn } from "@/lib/utils";

import { updateOrganizationCallRouting } from "../../actions";

type CallRoutingCardProps = {
  organizationId: string;
  initialMode: CallRoutingMode;
  initialTransferNumber: string;
  /** The tenant's assigned Cliste DID (divert target), if any. */
  clisteNumber: string | null;
};

/** Admin-side call routing: how the store's line reaches Cara. */
export function CallRoutingCard({
  organizationId,
  initialMode,
  initialTransferNumber,
  clisteNumber,
}: CallRoutingCardProps) {
  const [mode, setMode] = useState<CallRoutingMode>(initialMode);
  const [transferNumber, setTransferNumber] = useState(initialTransferNumber);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const codes = useMemo(
    () => forwardingCodesForMode(mode, clisteNumber ?? ""),
    [mode, clisteNumber],
  );
  const allowsTransfer = CALL_ROUTING_MODE_META[mode].allowsTransfer;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Call routing</CardTitle>
        <CardDescription>
          How callers reach Cara. For forwarding modes, give the store the
          divert codes below to dial on their own phone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            startTransition(async () => {
              const r = await updateOrganizationCallRouting(organizationId, {
                callRoutingMode: mode,
                transferNumber,
              });
              setMsg(r.ok ? "Saved." : r.message);
            });
          }}
        >
          <div className="space-y-2">
            {CALL_ROUTING_MODES.map((id) => {
              const meta = CALL_ROUTING_MODE_META[id];
              const active = mode === id;
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                    active
                      ? "border-gray-900 bg-gray-50"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="call-routing-mode"
                    value={id}
                    checked={active}
                    onChange={() => setMode(id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-foreground block text-sm font-medium">
                      {meta.title}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {meta.tagline}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {allowsTransfer ? (
            <div className="space-y-2">
              <Label htmlFor="admin-transfer-number">
                Transfer number (optional)
              </Label>
              <Input
                id="admin-transfer-number"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="+353 87 123 4567"
                className="max-w-xs font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Where Cara puts callers through when they need a human.
              </p>
            </div>
          ) : null}

          {codes.length > 0 ? (
            <div className="border-border bg-card space-y-2 rounded-lg border px-3 py-2.5">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Divert codes for the store
              </p>
              {clisteNumber?.trim() ? null : (
                <p className="text-xs text-amber-700">
                  Assign a Cliste number first — the codes below need it as the
                  divert target.
                </p>
              )}
              {codes.map((c) => (
                <p key={c.kind} className="text-sm">
                  <span className="text-foreground font-medium">{c.label}:</span>{" "}
                  <code className="text-xs">{c.activate}</code>{" "}
                  <span className="text-muted-foreground text-xs">
                    (cancel {c.cancel})
                  </span>
                </p>
              ))}
              <p className="text-muted-foreground text-xs">
                Cancel every divert: <code>{CANCEL_ALL_FORWARDING_CODE}</code>
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save call routing"}
            </Button>
            {msg ? (
              <p
                className={cn(
                  "text-sm",
                  msg === "Saved."
                    ? "font-medium text-emerald-700"
                    : "text-destructive",
                )}
              >
                {msg}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
