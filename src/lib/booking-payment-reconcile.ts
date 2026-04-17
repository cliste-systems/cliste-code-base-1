import "server-only";

import type Stripe from "stripe";

import {
  buildBookingConfirmationSmsBody,
  sendTwilioBookingSms,
} from "@/lib/booking-confirmation-sms";
import { buildBookingConfirmationEmailBodies } from "@/lib/booking-transactional-email";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { getStripeClient, stripeIsConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Stripe webhooks are the source of truth for payment status, but events can
 * be missed (signing-secret mismatch, edge timeouts, dropped TLS handshakes,
 * Stripe-side retries that 5xx, …). The dashboard Payments page polls this
 * helper on load so any appointment that is still `pending` in our DB but
 * actually `succeeded` in Stripe gets flipped server-side, and the customer
 * still receives their SMS / email.
 *
 * Safe to call frequently:
 *   - Idempotent (DB writes are guarded by current payment_status).
 *   - Cheap (one Stripe retrieve per pending PI; capped to 25 per call).
 *   - Skips PIs created in the last 60s so we don't race the customer's own
 *     `confirmPayment` redirect.
 */
export async function reconcilePendingAppointmentPayments(args: {
  organizationId: string;
  /** Cap on how many pending PIs to retrieve per call. */
  limit?: number;
}): Promise<{
  checked: number;
  flippedToPaid: number;
  flippedToFailed: number;
}> {
  const { organizationId, limit = 25 } = args;
  if (!stripeIsConfigured()) {
    return { checked: 0, flippedToPaid: 0, flippedToFailed: 0 };
  }

  const admin = createAdminClient();
  const stripe = getStripeClient();

  const minAgeIso = new Date(Date.now() - 60_000).toISOString();

  type PendingRow = {
    id: string;
    organization_id: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
    start_time: string;
    booking_reference: string | null;
    payment_status: string | null;
    stripe_payment_intent_id: string | null;
    confirmation_sms_sent_at: string | null;
    confirmation_email_sent_at: string | null;
    service: { name: string | null } | { name: string | null }[] | null;
    organization:
      | { name: string | null; slug: string | null }
      | { name: string | null; slug: string | null }[]
      | null;
  };

  const { data: pending } = await admin
    .from("appointments")
    .select(
      "id, organization_id, customer_name, customer_phone, customer_email, start_time, booking_reference, payment_status, stripe_payment_intent_id, confirmation_sms_sent_at, confirmation_email_sent_at, service:services(name), organization:organizations(name, slug)",
    )
    .eq("organization_id", organizationId)
    .eq("payment_status", "pending")
    .not("stripe_payment_intent_id", "is", null)
    .lt("created_at", minAgeIso)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PendingRow[]>();

  const rows = pending ?? [];
  if (rows.length === 0) {
    return { checked: 0, flippedToPaid: 0, flippedToFailed: 0 };
  }

  let flippedToPaid = 0;
  let flippedToFailed = 0;

  // Sequential to avoid hammering Stripe; volume here is tiny (≤ limit).
  for (const row of rows) {
    const piId = row.stripe_payment_intent_id;
    if (!piId) continue;

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(piId, {
        expand: ["latest_charge"],
      });
    } catch (err) {
      console.warn(
        "[reconcile] paymentIntents.retrieve failed",
        piId,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    if (pi.status === "succeeded") {
      const updated = await markPaid(admin, row, pi);
      if (updated) flippedToPaid += 1;
    } else if (
      pi.status === "canceled" ||
      pi.status === "requires_payment_method"
    ) {
      const updated = await markFailed(admin, row.id);
      if (updated) flippedToFailed += 1;
    }
    // Other statuses (`processing`, `requires_action`, etc.) — leave pending.
  }

  return { checked: rows.length, flippedToPaid, flippedToFailed };
}

function pickJoined<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

async function markPaid(
  admin: AdminClient,
  row: {
    id: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
    start_time: string;
    booking_reference: string | null;
    confirmation_sms_sent_at: string | null;
    confirmation_email_sent_at: string | null;
    service: { name: string | null } | { name: string | null }[] | null;
    organization:
      | { name: string | null; slug: string | null }
      | { name: string | null; slug: string | null }[]
      | null;
  },
  pi: Stripe.PaymentIntent,
): Promise<boolean> {
  let chargeId: string | null = null;
  if (typeof pi.latest_charge === "string") chargeId = pi.latest_charge;
  else if (pi.latest_charge && typeof pi.latest_charge === "object")
    chargeId = pi.latest_charge.id;

  const amountCents =
    typeof pi.amount_received === "number" && pi.amount_received > 0
      ? pi.amount_received
      : pi.amount;
  const currency = pi.currency?.toLowerCase() ?? null;

  const { error: updErr } = await admin
    .from("appointments")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: pi.id,
      stripe_charge_id: chargeId,
      ...(amountCents != null ? { amount_cents: amountCents } : {}),
      ...(currency ? { currency } : {}),
    })
    .eq("id", row.id)
    .eq("payment_status", "pending"); // optimistic guard against races

  if (updErr) {
    console.warn(
      "[reconcile] update to paid failed",
      row.id,
      updErr.message,
    );
    return false;
  }

  // Same once-only confirmations as the webhook path.
  const salonName = pickJoined(row.organization)?.name ?? "Your salon";
  const serviceName = pickJoined(row.service)?.name ?? "your appointment";
  const customerPhone = row.customer_phone ?? "";
  const customerEmail = row.customer_email ?? "";
  const customerName = row.customer_name ?? "";
  const bookingRef = row.booking_reference ?? row.id.slice(0, 8);

  if (!row.confirmation_sms_sent_at && customerPhone) {
    const body = buildBookingConfirmationSmsBody({
      customerName,
      salonName,
      serviceName,
      startTimeIso: row.start_time,
      bookingReference: bookingRef,
    });
    const sms = await sendTwilioBookingSms(customerPhone, body);
    if (sms.ok) {
      await admin
        .from("appointments")
        .update({ confirmation_sms_sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  if (
    !row.confirmation_email_sent_at &&
    customerEmail &&
    isSendGridConfigured()
  ) {
    const emailBodies = buildBookingConfirmationEmailBodies({
      customerName,
      salonName,
      serviceName,
      startTimeIso: row.start_time,
      bookingReference: bookingRef,
    });
    const er = await sendTransactionalEmail({
      to: customerEmail,
      subject: emailBodies.subject,
      text: emailBodies.text,
      html: emailBodies.html,
    });
    if (er.ok) {
      await admin
        .from("appointments")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return true;
}

async function markFailed(
  admin: AdminClient,
  appointmentId: string,
): Promise<boolean> {
  const { error } = await admin
    .from("appointments")
    .update({ payment_status: "failed" })
    .eq("id", appointmentId)
    .eq("payment_status", "pending");
  if (error) {
    console.warn("[reconcile] update to failed", appointmentId, error.message);
    return false;
  }
  return true;
}
