"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { refundAppointmentPayment } from "./actions";

/**
 * Payment-row action cluster: "View" opens a read-only detail panel; "Refund"
 * prompts for confirmation then calls the `refundAppointmentPayment` server
 * action (which re-validates that the appointment belongs to the operator's
 * organisation — the client can't refund anything on its own).
 */
export type PaymentRowActionsProps = {
  appointmentId: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceName: string | null;
  startTimeIso: string;
  amountCents: number | null;
  platformFeeCents: number | null;
  currency: string | null;
  paymentStatus: string | null;
  paidAtIso: string | null;
  bookingReference: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
};

export function PaymentRowActions(props: PaymentRowActionsProps) {
  const [open, setOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  const canRefund = props.paymentStatus === "paid" && !!props.stripePaymentIntentId;

  function onRefundConfirm() {
    setFeedback(null);
    startTransition(async () => {
      const res = await refundAppointmentPayment(props.appointmentId);
      if (res.ok) {
        setFeedback({
          kind: "success",
          message: `Refunded ${formatMoney(res.refundedCents, res.currency)}.`,
        });
        setRefundOpen(false);
      } else {
        setFeedback({ kind: "error", message: res.message });
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => setOpen(true)}
        >
          View
        </Button>
        {canRefund ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-red-200 px-2.5 text-xs text-red-700 hover:bg-red-50"
            onClick={() => {
              setFeedback(null);
              setRefundOpen(true);
            }}
            disabled={pending}
          >
            <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
            Refund
          </Button>
        ) : null}
      </div>

      {/* Detail panel */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Payment details</DialogTitle>
            <DialogDescription>
              {props.bookingReference
                ? `Booking #${props.bookingReference}`
                : "Booking details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <DetailField label="Customer" value={props.customerName} />
                <DetailField label="Service" value={props.serviceName} />
                <DetailField
                  label="Phone"
                  value={props.customerPhone}
                  mono
                />
                <DetailField
                  label="Email"
                  value={props.customerEmail}
                />
                <DetailField
                  label="Appointment"
                  value={new Date(props.startTimeIso).toLocaleString("en-IE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
                <DetailField
                  label="Paid at"
                  value={
                    props.paidAtIso
                      ? new Date(props.paidAtIso).toLocaleString("en-IE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : null
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Charged
                </span>
                <span className="font-semibold text-gray-900">
                  {formatMoney(props.amountCents, props.currency ?? "eur")}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">Cliste fee</span>
                <span className="text-gray-700">
                  − {formatMoney(props.platformFeeCents, props.currency ?? "eur")}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-medium">
                <span className="text-gray-700">Your payout</span>
                <span className="text-emerald-700">
                  {props.amountCents != null && props.platformFeeCents != null
                    ? formatMoney(
                        props.amountCents - props.platformFeeCents,
                        props.currency ?? "eur",
                      )
                    : "—"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-3 text-xs">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <CircleDollarSign className="h-3 w-3" aria-hidden />
                Stripe references
              </div>
              <DetailField
                label="Status"
                value={prettifyStatus(props.paymentStatus)}
              />
              <DetailField
                label="PaymentIntent"
                value={props.stripePaymentIntentId}
                mono
              />
              <DetailField
                label="Charge"
                value={props.stripeChargeId}
                mono
              />
              {props.stripePaymentIntentId ? (
                <a
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-sky-700 hover:underline"
                  href={`https://dashboard.stripe.com/payments/${props.stripePaymentIntentId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Stripe
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </div>

            {feedback ? (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  feedback.kind === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800",
                )}
              >
                <div className="flex items-center gap-2">
                  {feedback.kind === "success" ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  )}
                  {feedback.message}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            {canRefund ? (
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  setFeedback(null);
                  setRefundOpen(true);
                }}
                disabled={pending}
              >
                <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
                Refund payment
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund confirmation */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Refund this payment?</DialogTitle>
            <DialogDescription>
              Refunds the full{" "}
              <strong>
                {formatMoney(props.amountCents, props.currency ?? "eur")}
              </strong>{" "}
              to the customer and reverses Cliste&rsquo;s fee. This can&rsquo;t
              be undone from here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            It can take 5–10 business days to appear on the customer&rsquo;s
            statement.
          </div>
          {feedback?.kind === "error" ? (
            <p className="text-sm text-red-700">{feedback.message}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefundOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={onRefundConfirm}
              disabled={pending}
            >
              {pending ? "Refunding…" : "Yes, refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span
        className={cn(
          "truncate text-right text-gray-900",
          mono && "font-mono text-[12px]",
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function prettifyStatus(v: string | null): string | null {
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function formatMoney(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: (currency || "eur").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${(currency || "eur").toUpperCase()}`;
  }
}
