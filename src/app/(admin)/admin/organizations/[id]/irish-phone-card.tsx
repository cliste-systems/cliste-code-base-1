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
  type AssignPoolPhoneResult,
  assignPoolPhoneToOrganization,
} from "../../actions";

type IrishPhoneCardProps = {
  organizationId: string;
  phoneNumber: string | null;
};

/** Assigns the tenant's Cliste number from the Irish Twilio pool. */
export function IrishPhoneCard({
  organizationId,
  phoneNumber,
}: IrishPhoneCardProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AssignPoolPhoneResult | null>(null);

  const assign = useCallback(() => {
    setResult(null);
    startTransition(async () => {
      const r = await assignPoolPhoneToOrganization(organizationId);
      setResult(r);
    });
  }, [organizationId]);

  const hasNumber = Boolean(phoneNumber?.trim());

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Cliste number (Irish pool)</CardTitle>
        <CardDescription>
          Claims an Irish DID from the pre-bought Twilio pool (buying one if the
          pool is empty) and stores it on this organization so Cara answers its
          calls. The store forwards its own line to this number using the divert
          codes in the call-routing card below.
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
        </div>

        <Button
          type="button"
          className="gap-2"
          disabled={pending || hasNumber}
          title={
            hasNumber
              ? "This organization already has a number on file"
              : undefined
          }
          onClick={assign}
        >
          <Phone className="size-4" aria-hidden />
          {pending
            ? "Assigning…"
            : hasNumber
              ? "Number already assigned"
              : "Assign Irish number (pool)"}
        </Button>

        {result?.ok ? (
          <p
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
            role="status"
          >
            Assigned {result.e164}.
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
