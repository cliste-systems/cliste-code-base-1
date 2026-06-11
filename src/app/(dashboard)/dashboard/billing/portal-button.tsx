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
              if (res.ok) {
                window.location.href = res.url;
              } else {
                setError(res.message);
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
        className="inline-flex items-center justify-center rounded-xl bg-[#0b1220] px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[#0b1220]/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
