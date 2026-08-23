"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Mail } from "lucide-react";

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
  callRoutingAllowsHumanTransfer,
  forwardingCodesForMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { DIVERT_CARRIERS, type DivertCarrier } from "@/lib/retail-store-types";
import { cn } from "@/lib/utils";

import {
  sendDivertCodesToOwner,
  updateOrganizationCallRouting,
} from "../../actions";

type CallRoutingCardProps = {
  organizationId: string;
  initialMode: CallRoutingMode;
  initialTransferNumber: string;
  initialStorePublicNumber?: string;
  initialDivertCarrier?: string;
  clisteNumber: string | null;
  routingConfiguredComplete?: boolean;
  retail?: boolean;
};

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Admin-side call routing: how the store's line reaches Cara. */
export function CallRoutingCard({
  organizationId,
  initialMode,
  initialTransferNumber,
  initialStorePublicNumber = "",
  initialDivertCarrier = "",
  clisteNumber,
  routingConfiguredComplete,
  retail = false,
}: CallRoutingCardProps) {
  const [mode, setMode] = useState<CallRoutingMode>(initialMode);
  const [transferNumber, setTransferNumber] = useState(initialTransferNumber);
  const [storePublicNumber, setStorePublicNumber] = useState(
    initialStorePublicNumber,
  );
  const [divertCarrier, setDivertCarrier] = useState(initialDivertCarrier);
  const [msg, setMsg] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();

  const hasClisteNumber = Boolean(clisteNumber?.trim());
  const codes = useMemo(
    () =>
      hasClisteNumber
        ? forwardingCodesForMode(mode, clisteNumber ?? "")
        : [],
    [mode, clisteNumber, hasClisteNumber],
  );
  const allowsTransfer = CALL_ROUTING_MODE_META[mode].allowsTransfer;

  const loopWarning =
    retail &&
    allowsTransfer &&
    storePublicNumber.trim() &&
    transferNumber.trim() &&
    normalizePhoneDigits(storePublicNumber) ===
      normalizePhoneDigits(transferNumber);

  const copyCodes = async () => {
    const lines = [
      ...codes.map((c) => `${c.label}: ${c.activate} (cancel ${c.cancel})`),
      `Cancel all: ${CANCEL_ALL_FORWARDING_CODE}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Call routing</CardTitle>
            <CardDescription>
              How callers reach Cara and where human transfers go. Save routing
              before emailing divert codes to the owner.
            </CardDescription>
          </div>
          {routingConfiguredComplete ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200/80 ring-inset">
              Configured
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {!hasClisteNumber ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Assign a Cliste number first — routing and divert codes need a
            target DID.
          </p>
        ) : null}

        <fieldset disabled={!hasClisteNumber} className="space-y-4">
          {retail ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="store-public-number">Store public number</Label>
                <Input
                  id="store-public-number"
                  value={storePublicNumber}
                  onChange={(e) => setStorePublicNumber(e.target.value)}
                  placeholder="+353 74 972 1234"
                  className="max-w-sm font-mono text-sm"
                />
                <p className="text-muted-foreground text-xs">
                  The number customers dial today (before divert).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="divert-carrier">Divert carrier</Label>
                <select
                  id="divert-carrier"
                  value={divertCarrier}
                  onChange={(e) => setDivertCarrier(e.target.value)}
                  className="border-input bg-background h-9 max-w-sm rounded-md border px-3 text-sm"
                >
                  <option value="">Select carrier…</option>
                  {DIVERT_CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

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
                    !hasClisteNumber && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="call-routing-mode"
                    value={id}
                    checked={active}
                    onChange={() => setMode(id)}
                    className="mt-1"
                    disabled={!hasClisteNumber}
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
              <Label htmlFor="admin-transfer-number">Transfer number</Label>
              <Input
                id="admin-transfer-number"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="+353 87 123 4567"
                className="max-w-sm font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Manager mobile or desk extension that is{" "}
                <strong>not</strong> forwarded to Cara.
              </p>
              {loopWarning ? (
                <p className="text-destructive text-xs" role="alert">
                  Transfer number matches the store public line — this creates a
                  divert loop. Use a manager mobile or non-diverted extension.
                </p>
              ) : null}
            </div>
          ) : null}

          {codes.length > 0 ? (
            <div className="border-border bg-card space-y-2 rounded-lg border px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Divert codes
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => void copyCodes()}
                >
                  <Copy className="size-3" aria-hidden />
                  Copy
                </Button>
              </div>
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
            <Button
              type="button"
              disabled={pending || !hasClisteNumber || Boolean(loopWarning)}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  const r = await updateOrganizationCallRouting(
                    organizationId,
                    {
                      callRoutingMode: mode,
                      transferNumber,
                      ...(retail
                        ? {
                            storePublicNumber,
                            divertCarrier: divertCarrier as DivertCarrier,
                          }
                        : {}),
                    },
                  );
                  setMsg(r.ok ? "Saved." : r.message);
                });
              }}
            >
              {pending ? "Saving…" : "Save call routing"}
            </Button>

            {retail && hasClisteNumber && codes.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={emailPending}
                onClick={() => {
                  setEmailMsg(null);
                  startEmailTransition(async () => {
                    const r = await sendDivertCodesToOwner(organizationId);
                    setEmailMsg(r.ok ? "Divert codes emailed to owner." : r.message);
                  });
                }}
              >
                <Mail className="size-4" aria-hidden />
                {emailPending ? "Sending…" : "Email codes to owner"}
              </Button>
            ) : null}

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
            {emailMsg ? (
              <p
                className={cn(
                  "text-sm",
                  emailMsg.includes("emailed")
                    ? "font-medium text-emerald-700"
                    : "text-destructive",
                )}
              >
                {emailMsg}
              </p>
            ) : null}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
