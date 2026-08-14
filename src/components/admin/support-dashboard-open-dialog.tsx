"use client";

import { useCallback, useState, useTransition } from "react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createSupportDashboardLink } from "@/app/(admin)/admin/actions";

type SupportDashboardOpenDialogProps = {
  organizationId: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost" | "default";
  compact?: boolean;
};

export function SupportDashboardOpenDialog({
  organizationId,
  triggerLabel = "Open dashboard",
  triggerClassName,
  triggerVariant = "outline",
  compact = false,
}: SupportDashboardOpenDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await createSupportDashboardLink(
        organizationId,
        typeof window !== "undefined" ? window.location.origin : null,
        reason,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setReason("");
      const w = window.open(result.url, "_blank", "noopener,noreferrer");
      if (!w) {
        window.location.assign(result.url);
      }
    });
  }, [organizationId, reason]);

  return (
    <>
      {compact ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className={
            triggerClassName ??
            "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 focus:outline-none disabled:opacity-60"
          }
        >
          <LogIn className="size-3.5 text-gray-400" aria-hidden />
          {pending ? "Opening…" : triggerLabel}
        </button>
      ) : (
        <Button
          type="button"
          variant={triggerVariant}
          className={triggerClassName ?? "gap-2"}
          disabled={pending}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <LogIn className="size-4" aria-hidden />
          {pending ? "Opening…" : triggerLabel}
        </Button>
      )}

      {error && !open ? (
        <p
          className={
            compact
              ? "max-w-[14rem] text-right text-xs leading-snug text-red-600"
              : "text-destructive text-xs"
          }
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open tenant dashboard</DialogTitle>
            <DialogDescription>
              You will sign in as a member of this account. This action is
              audited — enter why you need access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`support-reason-${organizationId}`}>
              Reason for access
            </Label>
            <Textarea
              id={`support-reason-${organizationId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Customer reported misconfigured call routing"
              rows={3}
              disabled={pending}
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || reason.trim().length < 8}
              onClick={submit}
            >
              {pending ? "Opening…" : "Open dashboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
