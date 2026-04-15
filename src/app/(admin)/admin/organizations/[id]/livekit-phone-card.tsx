"use client";

import { useCallback, useState, useTransition } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  type AssignLivekitUsPhoneResult,
  assignLivekitUsPhoneToOrganization,
} from "../../actions";

type LiveKitPhoneCardProps = {
  organizationId: string;
  phoneNumber: string | null;
};

export function LiveKitPhoneCard({
  organizationId,
  phoneNumber,
}: LiveKitPhoneCardProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AssignLivekitUsPhoneResult | null>(null);

  const assign = useCallback(() => {
    setResult(null);
    startTransition(async () => {
      const r = await assignLivekitUsPhoneToOrganization(organizationId);
      setResult(r);
    });
  }, [organizationId]);

  const hasNumber = Boolean(phoneNumber?.trim());

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">LiveKit phone (US)</CardTitle>
        <CardDescription>
          Buy a US number from LiveKit Cloud inventory and store it on this salon
          as <code className="text-xs">organizations.phone_number</code> so your
          voice agent can route inbound calls (E.164). Requires server env:{" "}
          <code className="text-xs">LIVEKIT_URL</code>,{" "}
          <code className="text-xs">LIVEKIT_API_KEY</code>,{" "}
          <code className="text-xs">LIVEKIT_API_SECRET</code>. Optionally set{" "}
          <code className="text-xs">LIVEKIT_SIP_DISPATCH_RULE_ID</code> to attach
          your SIP dispatch rule when purchasing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-border bg-card rounded-lg border px-3 py-2 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Number on file
          </p>
          <p className="text-foreground mt-1 font-mono text-sm font-semibold tabular-nums">
            {hasNumber ? phoneNumber : "— none assigned —"}
          </p>
          <p className="text-muted-foreground mt-2 text-xs leading-snug">
            {hasNumber
              ? "Read-only summary from the database (not an input). Assign stays off while a number exists so LiveKit isn’t charged for a duplicate."
              : "After you assign, the E.164 value is stored on the organization row."}
          </p>
        </div>

        <Button
          type="button"
          className="gap-2"
          disabled={pending || hasNumber}
          title={
            hasNumber
              ? "Clear phone_number in Supabase first if you need a different LiveKit number"
              : undefined
          }
          onClick={assign}
        >
          <Phone className="size-4" aria-hidden />
          {pending
            ? "Contacting LiveKit…"
            : hasNumber
              ? "Number already assigned"
              : "Assign US number (LiveKit)"}
        </Button>

        {hasNumber ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            To use a different number: clear{" "}
            <code className="text-xs">phone_number</code> for this org in
            Supabase, release the old number in LiveKit Cloud if you no longer
            need it, then use Assign again.
          </p>
        ) : null}

        {result?.ok ? (
          <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium" role="status">
            Assigned {result.e164}. Your agent stack should read this from the
            org record (or sync from Supabase).
          </p>
        ) : null}
        {result && !result.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {result.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
