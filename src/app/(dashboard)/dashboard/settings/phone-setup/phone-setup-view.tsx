"use client";

import { useState, useTransition } from "react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TransferVerdict } from "@/lib/transfer-capability-messages";
import { PhoneForwarded } from "lucide-react";

import { requestPhoneSetupReview } from "./actions";

type DeptRow = {
  id: string;
  name: string;
  canTransfer: boolean;
};

type Props = {
  storeName: string;
  verdict: TransferVerdict;
  activeDepartments: DeptRow[];
  transferVerifiedAt: string | null;
  clisteNumber: string | null;
  clisteDetail: string;
};

const TONE_CLASS: Record<TransferVerdict["tone"], string> = {
  green: "border-emerald-200 bg-emerald-50",
  amber: "border-amber-200 bg-amber-50",
  grey: "border-slate-200 bg-slate-50",
};

export function PhoneSetupView({
  storeName,
  verdict,
  activeDepartments,
  transferVerifiedAt,
  clisteNumber,
  clisteDetail,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verifiedLabel = transferVerifiedAt
    ? new Date(transferVerifiedAt).toLocaleDateString("en-IE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <ClistePageHeader
        tone="account"
        icon={PhoneForwarded}
        title="Phone setup"
        description="Read-only view of how Cara handles department transfers for your store."
      />

      <div
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          TONE_CLASS[verdict.tone],
        )}
      >
        <p className="font-medium text-slate-900">{verdict.headline}</p>
        <p className="text-muted-foreground mt-1 text-xs">{verdict.detail}</p>
        {verifiedLabel ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Last verified: {verifiedLabel}
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Departments</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Cara either puts callers through or takes a message — she never reads
          phone numbers aloud.
        </p>
        <ul className="mt-3 space-y-2">
          {activeDepartments.length === 0 ? (
            <li className="text-muted-foreground text-sm">
              No active departments configured yet.
            </li>
          ) : (
            activeDepartments.map((dept) => (
              <li
                key={dept.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{dept.name}</span>
                <span
                  className={
                    dept.canTransfer
                      ? "text-emerald-700 text-xs font-medium"
                      : "text-slate-600 text-xs"
                  }
                >
                  {dept.canTransfer ? "Can put through" : "Takes a message"}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Cliste number</h2>
        <p className="text-muted-foreground mt-1 text-xs">{clisteDetail}</p>
        {clisteNumber ? (
          <p className="mt-2 font-mono text-sm text-slate-800">{clisteNumber}</p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await requestPhoneSetupReview();
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setTicketId(result.ticketId);
            });
          }}
        >
          {pending ? "Sending…" : "Ask Cliste to review my phone setup"}
        </Button>
        {ticketId ? (
          <span className="text-sm text-emerald-700">
            Support ticket created for {storeName}.
          </span>
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
