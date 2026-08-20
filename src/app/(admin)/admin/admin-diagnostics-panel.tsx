"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Mail } from "lucide-react";

import { cn } from "@/lib/utils";

import { testSendGridConnection } from "./actions";

type AdminDiagnosticsPanelProps = {
  bookingValue: string;
  infraCost: string | null;
  periodLabel: string;
  voiceCostSchemaMissing: boolean;
};

export function AdminDiagnosticsPanel({
  bookingValue,
  infraCost,
  periodLabel,
  voiceCostSchemaMissing,
}: AdminDiagnosticsPanelProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  function runTest() {
    setMessage(null);
    setOk(null);
    startTransition(async () => {
      const r = await testSendGridConnection();
      setOk(r.ok);
      setMessage(r.ok ? "Test email sent — check your inbox." : r.message);
    });
  }

  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white"
      aria-labelledby="admin-diagnostics-heading"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left sm:px-5"
        aria-expanded={open}
      >
        <div>
          <h2
            id="admin-diagnostics-heading"
            className="text-sm font-semibold text-[#0b1220]"
          >
            Diagnostics
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Email tests and secondary metrics
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <dt className="text-xs text-slate-500">Booking value · {periodLabel}</dt>
              <dd className="mt-1 font-semibold tabular-nums text-[#0b1220]">
                {bookingValue}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <dt className="text-xs text-slate-500">Est. infra cost · {periodLabel}</dt>
              <dd className="mt-1 font-semibold tabular-nums text-[#0b1220]">
                {voiceCostSchemaMissing
                  ? "Unavailable"
                  : infraCost ?? "—"}
              </dd>
            </div>
          </dl>

          {voiceCostSchemaMissing ? (
            <p className="text-xs text-amber-800">
              Voice cost needs the <code className="font-mono">cost_estimate</code> column on{" "}
              <code className="font-mono">call_logs</code>.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                <Mail className="size-4" strokeWidth={1.5} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-[#0b1220]">SendGrid</p>
                <p className="text-xs text-slate-500">
                  Send a test message to your staff email.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={runTest}
              disabled={pending}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send test email"}
            </button>
          </div>
          {message ? (
            <p
              className={cn(
                "text-sm",
                ok === true
                  ? "text-emerald-700"
                  : ok === false
                    ? "text-red-700"
                    : "text-slate-600",
              )}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
