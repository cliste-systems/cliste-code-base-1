import type Stripe from "stripe";

export class PlatformCheckoutNotCompleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformCheckoutNotCompleteError";
  }
}

/** Reject open/unpaid Checkout sessions before persisting billing or activating. */
export function assertPlatformCheckoutSessionComplete(
  session: Pick<
    Stripe.Checkout.Session,
    "status" | "payment_status" | "subscription"
  >,
): void {
  if (session.status !== "complete") {
    throw new PlatformCheckoutNotCompleteError(
      `Checkout session is not complete (status: ${session.status}).`,
    );
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!subscriptionId?.trim()) {
    throw new PlatformCheckoutNotCompleteError(
      "Checkout session has no subscription.",
    );
  }

  const paymentStatus = session.payment_status;
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    throw new PlatformCheckoutNotCompleteError(
      `Checkout payment is not confirmed (payment_status: ${paymentStatus}).`,
    );
  }
}
