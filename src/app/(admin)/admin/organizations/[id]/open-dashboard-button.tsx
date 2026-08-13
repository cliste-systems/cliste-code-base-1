"use client";

import { useCallback, useState, useTransition } from "react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

import { createSupportDashboardLink } from "../../actions";

type OpenDashboardButtonProps = {
  organizationId: string;
};

/** Signs support in as a member so config can be checked end-to-end. */
export function OpenDashboardButton({
  organizationId,
}: OpenDashboardButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await createSupportDashboardLink(
        organizationId,
        typeof window !== "undefined" ? window.location.origin : null,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const w = window.open(result.url, "_blank", "noopener,noreferrer");
      if (!w) {
        window.location.assign(result.url);
      }
    });
  }, [organizationId]);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={pending}
        onClick={open}
      >
        <LogIn className="size-4" aria-hidden />
        {pending ? "Opening…" : "Open dashboard as tenant"}
      </Button>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
