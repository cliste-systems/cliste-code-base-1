"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { triggerPhonePoolRefill } from "./actions";

export function TriggerRefillButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            setMsg(null);
            try {
              const r = await triggerPhonePoolRefill();
              setMsg(
                r.purchased > 0
                  ? `Purchased ${r.purchased} number${r.purchased === 1 ? "" : "s"}.`
                  : r.skippedReason
                    ? `No action needed (${r.skippedReason}).`
                    : "No action needed.",
              );
              router.refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Refill failed.");
            }
          })
        }
        className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        {pending ? "Refilling…" : "Trigger refill now"}
      </button>
      {msg ? <p className="text-xs text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
