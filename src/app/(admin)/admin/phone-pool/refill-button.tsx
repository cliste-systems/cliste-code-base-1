"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import { triggerPhonePoolRefill } from "./actions";

export function PhonePoolToolbar() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "info" | "error";
    message: string;
  } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setFeedback(null);
              try {
                const r = await triggerPhonePoolRefill();
                const message =
                  r.purchased > 0
                    ? `Purchased ${r.purchased} number${r.purchased === 1 ? "" : "s"}.`
                    : r.skippedReason
                      ? `No action needed — ${r.skippedReason}`
                      : "No action needed.";
                setFeedback({ tone: "info", message });
                router.refresh();
              } catch (e) {
                setFeedback({
                  tone: "error",
                  message:
                    e instanceof Error ? e.message : "Refill failed.",
                });
              }
            })
          }
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={cn("size-3.5", pending && "animate-spin")}
            aria-hidden
          />
          {pending ? "Refilling…" : "Trigger refill now"}
        </button>
      </div>

      {feedback ? (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-gray-200 bg-gray-50 text-gray-700",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
