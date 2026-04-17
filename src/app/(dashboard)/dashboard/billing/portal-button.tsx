"use client";

import { useState, useTransition } from "react";

import { openBillingPortal } from "./actions";

export function OpenBillingPortalButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const res = await openBillingPortal();
              if (res?.url) {
                window.location.href = res.url;
              } else {
                setError("Could not open billing portal.");
              }
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not open billing portal.",
              );
            }
          })
        }
        className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Opening…" : "Manage subscription"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
