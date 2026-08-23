"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { retryTwilioIe1MessagingRegion } from "../../actions";

type PhoneLineVerifyCardProps = {
  organizationId: string;
  clisteNumber: string | null;
  firstCallAt: string | null;
  messagingRegion: string | null;
  messagingRegionOk: boolean;
  messagingRegionError?: string | null;
};

export function PhoneLineVerifyCard({
  organizationId,
  clisteNumber,
  firstCallAt,
  messagingRegion,
  messagingRegionOk,
  messagingRegionError,
}: PhoneLineVerifyCardProps) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const hasNumber = Boolean(clisteNumber?.trim());

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Verify line & SMS</CardTitle>
        <CardDescription>
          Confirm inbound calls reach Cara and the Twilio DID is pinned to IE1
          for SMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Test call
          </p>
          <p className="mt-1">
            {firstCallAt
              ? `Verified by a real call on ${new Date(firstCallAt).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}.`
              : "No inbound call recorded yet — dial the Cliste number once divert is active."}
          </p>
        </div>

        {hasNumber ? (
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              SMS region (Twilio)
            </p>
            <p className="mt-1 font-mono text-sm">
              {messagingRegionOk
                ? messagingRegion ?? "IE1"
                : messagingRegionError ?? "Unknown"}
            </p>
            {!messagingRegionOk || messagingRegion !== "ie1" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 gap-2"
                disabled={pending}
                onClick={() => {
                  setMsg(null);
                  startTransition(async () => {
                    const r = await retryTwilioIe1MessagingRegion(organizationId);
                    setMsg(r.ok ? "IE1 region updated." : r.message);
                  });
                }}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                {pending ? "Retrying…" : "Retry IE1 messaging region"}
              </Button>
            ) : null}
            {msg ? (
              <p
                className={
                  msg.includes("updated")
                    ? "mt-2 text-emerald-700"
                    : "text-destructive mt-2"
                }
              >
                {msg}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
