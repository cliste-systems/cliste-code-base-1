"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";

import { submitPublicBooking } from "@/app/[salonSlug]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PublicBookingService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type PublicBookingDialogProps = {
  organizationId: string;
  salonSlug: string;
  service: PublicBookingService;
};

function formatEur(price: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function PublicBookingDialog({
  organizationId,
  salonSlug,
  service,
}: PublicBookingDialogProps) {
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const whenId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [toastEmailLine, setToastEmailLine] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        reset();
      }
    },
    [reset]
  );

  useEffect(() => {
    if (!toast) return;
    const ms = toastEmailLine ? 12_000 : 5000;
    const t = window.setTimeout(() => {
      setToast(false);
      setToastEmailLine(null);
    }, ms);
    return () => window.clearTimeout(t);
  }, [toast, toastEmailLine]);

  return (
    <>
      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 left-1/2 z-[100] max-w-sm -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-900 shadow-lg",
            "dark:border-emerald-900/50 dark:bg-emerald-950 dark:text-emerald-100"
          )}
        >
          <p>Booking confirmed!</p>
          {toastEmailLine ? (
            <p className="mt-2 text-xs font-normal leading-snug text-emerald-950/90 dark:text-emerald-100/90">
              {toastEmailLine}
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 min-h-9 shrink-0 rounded-md border-stone-300 bg-white px-4 text-sm font-semibold shadow-none hover:bg-stone-50 dark:border-zinc-600 dark:bg-transparent dark:hover:bg-zinc-900"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Book
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Book {service.name}</DialogTitle>
            <DialogDescription>
              {formatEur(service.price)} · {service.duration} min
            </DialogDescription>
          </DialogHeader>

          <form
              className="space-y-4 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                const form = e.currentTarget;
                const localWhen = (
                  form.elements.namedItem("start_local") as HTMLInputElement
                )?.value;
                if (!localWhen) {
                  setError("Please choose a date and time.");
                  return;
                }
                const start = new Date(localWhen);
                if (Number.isNaN(start.getTime())) {
                  setError("That date and time is not valid.");
                  return;
                }

                const fd = new FormData();
                fd.set(
                  "customer_name",
                  (form.elements.namedItem("customer_name") as HTMLInputElement)
                    .value
                );
                fd.set(
                  "customer_phone",
                  (form.elements.namedItem("customer_phone") as HTMLInputElement)
                    .value
                );
                fd.set(
                  "customer_email",
                  (form.elements.namedItem("customer_email") as HTMLInputElement)
                    ?.value ?? "",
                );
                fd.set("start_time_iso", start.toISOString());

                startTransition(async () => {
                  const result = await submitPublicBooking(
                    fd,
                    organizationId,
                    service.id,
                    salonSlug
                  );
                  if (!result.success) {
                    setError(result.message);
                    return;
                  }
                  setToastEmailLine(result.emailNotice ?? null);
                  form.reset();
                  handleOpenChange(false);
                  setToast(true);
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor={nameId}>Your name</Label>
                <Input
                  id={nameId}
                  name="customer_name"
                  autoComplete="name"
                  required
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={phoneId}>Phone</Label>
                <Input
                  id={phoneId}
                  name="customer_phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="+353 …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={emailId}>
                  Email <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id={emailId}
                  name="customer_email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={whenId}>Date &amp; time</Label>
                <Input
                  id={whenId}
                  name="start_local"
                  type="datetime-local"
                  required
                />
              </div>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <DialogFooter className="gap-2 pt-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Booking…" : "Confirm booking"}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
