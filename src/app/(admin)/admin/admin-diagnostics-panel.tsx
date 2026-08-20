"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Mail } from "lucide-react";

import { cn } from "@/lib/utils";

import { testSendGridConnection } from "./actions";

export function AdminDiagnosticsPanel() {
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
      className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]"
      aria-labelledby="admin-diagnostics-heading"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left sm:px-5"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2
            id="admin-diagnostics-heading"
            className="text-sm font-medium text-[#0b1220]"
          >
            Diagnostics
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Email delivery checks and other internal tooling.
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
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                <Mail className="size-4" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0b1220]">SendGrid</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Sends signup confirmation, invites, and system mail from the
                  platform sender.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={runTest}
              disabled={pending}
              className={cn(
                "shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm",
                "hover:bg-slate-50 disabled:opacity-50",
              )}
            >
              {pending ? "Sending…" : "Send test email"}
            </button>
          </div>
          {message ? (
            <p
              className={cn(
                "mt-3 text-sm",
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
