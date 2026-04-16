"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";

import { cn } from "@/lib/utils";

import { testSendGridConnection } from "./actions";

export function SendGridTestPanel() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  function runTest() {
    setMessage(null);
    setOk(null);
    startTransition(async () => {
      const r = await testSendGridConnection();
      setOk(r.ok);
      setMessage(r.ok ? "Check your inbox for the test message." : r.message);
    });
  }

  return (
    <section
      className="mb-14 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
      aria-labelledby="sendgrid-test-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
            <Mail className="size-4" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2
              id="sendgrid-test-heading"
              className="text-sm font-medium text-gray-900"
            >
              SendGrid (app email)
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Uses{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
                SENDGRID_API_KEY
              </code>
              ,{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
                SENDGRID_FROM_EMAIL
              </code>
              , optional{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
                SENDGRID_FROM_NAME
              </code>
              . Salon invites still go through Supabase Auth unless you configure
              Supabase SMTP with SendGrid.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={pending}
          className={cn(
            "shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm",
            "hover:bg-gray-50 disabled:opacity-50",
          )}
        >
          {pending ? "Sending…" : "Send test to my email"}
        </button>
      </div>
      {message ? (
        <p
          className={cn(
            "mt-4 text-sm",
            ok === true ? "text-emerald-800" : ok === false ? "text-red-800" : "text-gray-700",
          )}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
