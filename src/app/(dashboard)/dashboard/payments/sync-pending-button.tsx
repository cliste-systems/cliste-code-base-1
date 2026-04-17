"use client";

import { RefreshCw } from "lucide-react";
import { useTransition, useState } from "react";

import { syncPendingPayments } from "./actions";

/**
 * Manual "Sync with Stripe" trigger on /dashboard/payments. The page already
 * auto-reconciles on load; this button is for when the operator wants to
 * double-check after a failed webhook or while debugging.
 */
export function SyncPendingButton() {
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {lastResult ? (
        <span className="text-[11px] text-gray-500">{lastResult}</span>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const r = await syncPendingPayments();
              if (r.flippedToPaid > 0 || r.flippedToFailed > 0) {
                setLastResult(
                  `Updated ${r.flippedToPaid} paid, ${r.flippedToFailed} failed`,
                );
              } else if (r.checked > 0) {
                setLastResult(`Checked ${r.checked} — all still pending`);
              } else {
                setLastResult("Nothing to sync");
              }
            } catch {
              setLastResult("Sync failed");
            }
          })
        }
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw
          className={`h-3 w-3 ${pending ? "animate-spin" : ""}`}
          aria-hidden
        />
        {pending ? "Syncing…" : "Sync with Stripe"}
      </button>
    </div>
  );
}
