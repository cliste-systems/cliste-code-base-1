import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import {
  buildBookingConfirmationSmsBody,
  sendTwilioBookingSms,
} from "@/lib/booking-confirmation-sms";
import { buildBookingConfirmationEmailBodies } from "@/lib/booking-transactional-email";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
// Stripe needs the raw body bytes for signature verification, so caching
// (and any middleware transformation) must stay off this route.
export const dynamic = "force-dynamic";

/**
 * Stripe Connect webhook — the **source of truth** for booking payment state.
 *
 * Events we handle:
 *
 * - `payment_intent.succeeded` — booking paid. Mark `payment_status='paid'`
 *   and fire SMS + email confirmations (same templates the free-booking path
 *   uses). Idempotent: re-runs on the same appointment are no-ops.
 * - `payment_intent.payment_failed` — mark `payment_status='failed'` so the
 *   operator can see it and the slot is no longer held.
 * - `payment_intent.canceled` — treat as failed/freed.
 * - `charge.refunded` / `charge.refund.updated` — a refund landed (full or
 *   partial). Flip `payment_status='refunded'` when fully refunded.
 * - `account.updated` — sync connected-account capabilities onto the org row
 *   so `/dashboard/payments` shows accurate status.
 *
 * We also keep the Checkout handlers for safety even though the current
 * booking flow uses PaymentIntents directly — legacy Checkout sessions will
 * just no-op if they reach us.
 *
 * Security: every mutation here is keyed by `metadata.appointment_id` that we
 * wrote server-side when creating the intent — it's never trusted from client
 * input — and the whole request is gated on `constructEvent` signature
 * verification in production.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  const rawBody = await req.text();

  let event: Stripe.Event;
  const stripe = getStripeClient();
  if (secret && sig) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "invalid signature";
      console.warn("[stripe webhook] signature verification failed", msg);
      return new NextResponse(`Webhook Error: ${msg}`, { status: 400 });
    }
  } else {
    // Dev convenience when STRIPE_WEBHOOK_SECRET is not configured locally.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[stripe webhook] STRIPE_WEBHOOK_SECRET not set in production — rejecting.",
      );
      return new NextResponse("webhook secret not configured", { status: 500 });
    }
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return new NextResponse("invalid json", { status: 400 });
    }
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(admin, stripe, pi);
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(admin, pi);
        break;
      }
      case "charge.refunded":
      case "charge.refund.updated": {
        const obj = event.data.object as Stripe.Charge | Stripe.Refund;
        await handleRefund(admin, stripe, obj);
        break;
      }
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markAppointmentPaidFromSession(admin, stripe, session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markAppointmentExpiredFromSession(admin, session);
        break;
      }
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        await syncConnectedAccount(admin, acct);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", event.type, err);
    return new NextResponse("handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe-webhook" });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handlePaymentIntentSucceeded(
  admin: AdminClient,
  stripe: Stripe,
  pi: Stripe.PaymentIntent,
) {
  const appointmentId =
    (pi.metadata?.appointment_id ?? "").trim() || null;
  if (!appointmentId) {
    console.warn(
      "[stripe webhook] payment_intent.succeeded without appointment_id metadata",
      pi.id,
    );
    return;
  }

  // Charge id is handy for refunds + dashboard details.
  let chargeId: string | null = null;
  if (typeof pi.latest_charge === "string") chargeId = pi.latest_charge;
  else if (pi.latest_charge && typeof pi.latest_charge === "object")
    chargeId = pi.latest_charge.id;

  const amountCents =
    typeof pi.amount_received === "number" && pi.amount_received > 0
      ? pi.amount_received
      : pi.amount;
  const currency = pi.currency?.toLowerCase() ?? null;
  const paidAt = new Date().toISOString();

  // Load the appointment so we can (a) send confirmations (b) be idempotent
  // if this event replays.
  const { data: existing, error: readErr } = await admin
    .from("appointments")
    .select(
      "id, organization_id, customer_name, customer_phone, customer_email, start_time, booking_reference, payment_status, confirmation_sms_sent_at, confirmation_email_sent_at, service:services(name), organization:organizations(slug, name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (readErr) throw new Error(`read appointment: ${readErr.message}`);
  if (!existing) {
    console.warn(
      "[stripe webhook] payment_intent.succeeded for missing appointment",
      appointmentId,
    );
    return;
  }

  const alreadyPaid = existing.payment_status === "paid";

  const { error: updErr } = await admin
    .from("appointments")
    .update({
      payment_status: "paid",
      paid_at: paidAt,
      stripe_payment_intent_id: pi.id,
      stripe_charge_id: chargeId,
      ...(amountCents != null ? { amount_cents: amountCents } : {}),
      ...(currency ? { currency } : {}),
    })
    .eq("id", appointmentId);
  if (updErr) throw new Error(`update appointment paid: ${updErr.message}`);

  // Send SMS/email confirmations only once per booking. Both channels are
  // gated by their own `*_sent_at` column so a replayed event never
  // double-sends.
  const salonName =
    pickJoined(existing.organization)?.name ?? "Your salon";
  const serviceName = pickJoined(existing.service)?.name ?? "your appointment";
  const startIso = existing.start_time;
  const bookingRef = existing.booking_reference ?? appointmentId.slice(0, 8);
  const customerName = existing.customer_name ?? "";
  const customerPhone = existing.customer_phone ?? "";
  const customerEmail = existing.customer_email ?? "";

  if (!existing.confirmation_sms_sent_at && customerPhone) {
    const body = buildBookingConfirmationSmsBody({
      customerName,
      salonName,
      serviceName,
      startTimeIso: startIso,
      bookingReference: bookingRef,
    });
    const sms = await sendTwilioBookingSms(customerPhone, body);
    if (sms.ok) {
      await admin
        .from("appointments")
        .update({ confirmation_sms_sent_at: new Date().toISOString() })
        .eq("id", appointmentId);
    }
  }

  if (
    !existing.confirmation_email_sent_at &&
    customerEmail &&
    isSendGridConfigured()
  ) {
    const emailBodies = buildBookingConfirmationEmailBodies({
      customerName,
      salonName,
      serviceName,
      startTimeIso: startIso,
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
        .eq("id", appointmentId);
    } else {
      console.warn(
        "[stripe webhook] confirmation email failed",
        appointmentId,
        er.message,
      );
    }
  }

  if (!alreadyPaid) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/payments");
    const slug = pickJoined(existing.organization)?.slug;
    if (slug) revalidatePath(`/${slug}/booking/success`);
  }

  // Acknowledge — we intentionally don't look at the PI price vs. our stored
  // `amount_cents` here; Stripe signed what actually cleared, that wins.
  void stripe;
}

async function handlePaymentIntentFailed(
  admin: AdminClient,
  pi: Stripe.PaymentIntent,
) {
  const appointmentId =
    (pi.metadata?.appointment_id ?? "").trim() || null;
  if (!appointmentId) return;
  await admin
    .from("appointments")
    .update({
      payment_status: "failed",
      stripe_payment_intent_id: pi.id,
    })
    .eq("id", appointmentId)
    .in("payment_status", ["pending", "unpaid", "failed"]);
  revalidatePath("/dashboard/payments");
}

async function handleRefund(
  admin: AdminClient,
  stripe: Stripe,
  obj: Stripe.Charge | Stripe.Refund,
) {
  // Both shapes point at a payment_intent; normalise.
  let paymentIntentId: string | null = null;
  if ("payment_intent" in obj) {
    const pi = obj.payment_intent;
    if (typeof pi === "string") paymentIntentId = pi;
    else if (pi && typeof pi === "object") paymentIntentId = pi.id;
  }
  if (!paymentIntentId) return;

  // Fetch current refund state off the PI so we can decide "fully refunded".
  let fullyRefunded = false;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const latest = pi.latest_charge;
    if (latest && typeof latest === "object") {
      const charge = latest as Stripe.Charge;
      fullyRefunded =
        Boolean(charge.refunded) ||
        (typeof charge.amount_refunded === "number" &&
          charge.amount_refunded >= charge.amount);
    }
  } catch (err) {
    console.warn("[stripe webhook] retrieve PI during refund failed", err);
  }

  if (!fullyRefunded) {
    // Partial refund — leave `paid`, just dirty the dashboard.
    revalidatePath("/dashboard/payments");
    return;
  }

  await admin
    .from("appointments")
    .update({ payment_status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntentId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/payments");
}

async function markAppointmentPaidFromSession(
  admin: AdminClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const appointmentId =
    (session.metadata?.appointment_id ?? "").trim() || null;
  if (!appointmentId) return;

  let paymentIntentId: string | null = null;
  let chargeId: string | null = null;
  if (typeof session.payment_intent === "string") {
    paymentIntentId = session.payment_intent;
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });
      const latest = pi.latest_charge;
      if (typeof latest === "string") chargeId = latest;
      else if (latest && typeof latest === "object") chargeId = latest.id;
    } catch {}
  } else if (
    session.payment_intent &&
    typeof session.payment_intent === "object"
  ) {
    paymentIntentId = session.payment_intent.id;
  }

  await admin
    .from("appointments")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      ...(typeof session.amount_total === "number"
        ? { amount_cents: session.amount_total }
        : {}),
      ...(session.currency ? { currency: session.currency.toLowerCase() } : {}),
    })
    .eq("id", appointmentId);

  revalidatePath("/dashboard/payments");
}

async function markAppointmentExpiredFromSession(
  admin: AdminClient,
  session: Stripe.Checkout.Session,
) {
  const appointmentId =
    (session.metadata?.appointment_id ?? "").trim() || null;
  if (!appointmentId) return;
  await admin
    .from("appointments")
    .update({ payment_status: "unpaid" })
    .eq("id", appointmentId)
    .eq("payment_status", "pending");
}

async function syncConnectedAccount(admin: AdminClient, acct: Stripe.Account) {
  if (!acct.id) return;

  const detailsSubmitted = Boolean(acct.details_submitted);
  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);

  const { data: existing } = await admin
    .from("organizations")
    .select("id, stripe_onboarded_at")
    .eq("stripe_account_id", acct.id)
    .maybeSingle();
  if (!existing) return;

  const shouldSetOnboardedAt =
    chargesEnabled && detailsSubmitted && !existing.stripe_onboarded_at;

  await admin
    .from("organizations")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: detailsSubmitted,
      ...(shouldSetOnboardedAt
        ? { stripe_onboarded_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", existing.id);

  revalidatePath("/dashboard/payments");
}

/** Supabase-js can return joined rows as either an object or an array when
 *  the relationship is ambiguous. Normalise to the first element either way. */
function pickJoined<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return v;
}
