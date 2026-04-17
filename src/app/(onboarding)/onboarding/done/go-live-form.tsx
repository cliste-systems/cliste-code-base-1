"use client";

import { useState, useTransition } from "react";

import { completeOnboarding } from "../actions";

export function GoLiveForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              await completeOnboarding();
            } catch (err) {
              // completeOnboarding uses redirect() which throws NEXT_REDIRECT;
              // that's expected — only surface real errors here.
              if (err && typeof err === "object" && "digest" in err) return;
              setError(err instanceof Error ? err.message : "Failed to go live.");
            }
          })
        }
        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Going live…" : "Go live and open my dashboard"}
      </button>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
