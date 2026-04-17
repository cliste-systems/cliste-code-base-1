"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { pickNumberFromPool } from "../actions";

type Props = {
  existingNumber: string | null;
  availableIE: number;
};

export function PhonePickerForm({ existingNumber, availableIE }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(existingNumber);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {number ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Your Cliste number is ready.
          </p>
          <p className="rounded-lg bg-emerald-50 px-4 py-3 font-mono text-lg text-emerald-900">
            {number}
          </p>
          <button
            type="button"
            className="self-start rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
            onClick={() => router.push("/onboarding/done")}
          >
            Continue
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            {availableIE > 0 ? (
              <>Ready to claim one of {availableIE} Irish numbers from our pool.</>
            ) : (
              <>
                Our pool is currently empty. Click below to try anyway — we'll
                auto-provision a new one from Twilio if configured.
              </>
            )}
          </p>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await pickNumberFromPool();
                if (!res.ok) {
                  setError(res.message);
                  return;
                }
                setNumber(res.e164);
                router.refresh();
              })
            }
            className="self-start rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Assigning a number…" : "Claim my Cliste number"}
          </button>
        </div>
      )}
    </div>
  );
}
