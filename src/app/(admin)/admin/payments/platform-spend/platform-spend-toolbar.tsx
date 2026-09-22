"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import { refreshPlatformSpendApiData } from "./actions";

export function PlatformSpendToolbar({
  lastSyncedLabel,
}: {
  lastSyncedLabel: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await refreshPlatformSpendApiData();
            if (result.ok) {
              setMessage(result.message);
            } else {
              setError(result.message);
            }
          });
        }}
        className={adminPrimaryButtonClass}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="size-3.5" aria-hidden />
        )}
        Refresh API data
      </button>
      {lastSyncedLabel ? (
        <p className="text-xs text-gray-500">Last API sync: {lastSyncedLabel}</p>
      ) : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
