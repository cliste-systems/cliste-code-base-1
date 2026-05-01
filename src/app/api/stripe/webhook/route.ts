import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import {
  buildBookingConfirmationSmsBody,
  buildPaymentReceiptSmsBody,
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
  if (secret) {
    // If the webhook secret is configured, ALWAYS verify — regardless of
    // NODE_ENV. Otherwise an attacker who knows the URL could simply drop
    // the `stripe-signature` header and trigger the dev-fallback "parse any
    // JSON" branch — which would let them mark arbitrary appointments as
    // paid/refunded and trigger SMS/email confirmations.
    if (!sig) {
      console.warn(
        "[stripe webhook] STRIPE_WEBHOOK_SECRET set but stripe-signature header missing — rejecting.",
      );
      return new NextResponse("missing stripe-signature", { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "invalid signature";
      console.warn("[stripe webhook] signature verification failed", msg);
      // Constant body: don't echo raw crypto error text back to the
      // (unauthenticated) caller. Detail stays in server logs.
      return new NextResponse("invalid signature", { status: 400 });
    }
  } else {
    // No secret configured. Silently parsing unsigned payloads is a paid-status
    // forgery primitive, so refuse unless the operator has explicitly opted in.
    // NODE_ENV alone is not a safe gate — Vercel preview deploys often run
    // without `production` set but are still publicly addressable.
    if (process.env.CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS !== "1") {
      console.error(
        "[stripe webhook] STRIPE_WEBHOOK_SECRET not set — rejecting. Set CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1 for local fixture testing only.",
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
        if (session.mode === "subscription") {
          await handlePlatformCheckoutCompleted(admin, session);
        } else {
          await markAppointmentPaidFromSession(admin, stripe, session);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          await markAppointmentExpiredFromSession(admin, session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handlePlatformSubscriptionChange(admin, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handlePlatformSubscriptionDeleted(admin, sub);
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
      "id, organization_id, customer_name, customer_phone, customer_email, start_time, booking_reference, payment_status, confirmation_sms_sent_at, confirmation_email_sent_at, service_total_cents, deposit_cents, service:services(name), organization:organizations(slug, name)",
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

  // Decide whether this charge fully paid the booking, or is a deposit (so
  // there's still a balance owing to be collected in salon).
  const serviceTotal =
    typeof existing.service_total_cents === "number"
      ? existing.service_total_cents
      : null;
  const isDepositCharge =
    pi.metadata?.charge_kind === "deposit" ||
    (existing.deposit_cents != null &&
      serviceTotal != null &&
      amountCents != null &&
      amountCents < serviceTotal);
  const nextStatus: "paid" | "deposit_paid" = isDepositCharge
    ? "deposit_paid"
    : "paid";

  // ATOMIC FLIP — the conditional `payment_status not in ('paid','deposit_paid')`
  // clause makes this the single point where a new `paid`/`deposit_paid` event
  // "wins". Stripe can (and does) deliver `payment_intent.succeeded` more than
  // once: webhook retries, dashboard replays, multiple endpoints subscribed,
  // etc. By gating side effects (receipt SMS, revalidation) on whether we
  // *actually* flipped the row, we prevent duplicate confirmations even under
  // concurrent webhook deliveries. `select("id")` lets us read the
  // affected-rows count via the returned array length.
  const flip = await admin
    .from("appointments")
    .update({
      payment_status: nextStatus,
      paid_at: paidAt,
      stripe_payment_intent_id: pi.id,
      stripe_charge_id: chargeId,
      ...(amountCents != null ? { amount_cents: amountCents } : {}),
      ...(currency ? { currency } : {}),
    })
    .eq("id", appointmentId)
    .not("payment_status", "in", "(paid,deposit_paid)")
    .select("id");
  if (flip.error) throw new Error(`update appointment paid: ${flip.error.message}`);
  const wonRace = (flip.data?.length ?? 0) > 0;
  // Some metadata still needs to land even on replays (Stripe charge id
  // can change on partial captures) so write those without the gate.
  if (!wonRace) {
    await admin
      .from("appointments")
      .update({
        stripe_payment_intent_id: pi.id,
        ...(chargeId ? { stripe_charge_id: chargeId } : {}),
      })
      .eq("id", appointmentId);
  }
  const alreadyPaid = !wonRace;

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

  // Separate "payment received, see you then" SMS. The earlier SMS went out
  // at booking time with a pay link — that's a call-to-action, not a receipt.
  // This fires exactly once per successful payment (`!alreadyPaid` gate =
  // idempotent on webhook replays).
  if (!alreadyPaid && customerPhone) {
    const receiptBody = buildPaymentReceiptSmsBody({
      customerName,
      salonName,
      serviceName,
      startTimeIso: startIso,
      bookingReference: bookingRef,
      amountCents: amountCents ?? 0,
      currency: currency ?? "eur",
    });
    const receiptSms = await sendTwilioBookingSms(customerPhone, receiptBody);
    if (!receiptSms.ok) {
      console.warn(
        "[stripe webhook] payment receipt SMS failed",
        appointmentId,
        receiptSms.message,
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

/**
 * Platform billing — Stripe Billing subscription that pays Cliste.
 * Mirrors the subscription state onto organizations so the middleware can
 * suspend the dashboard when the salon stops paying us.
 */
async function handlePlatformCheckoutCompleted(
  admin: AdminClient,
  session: Stripe.Checkout.Session,
) {
  const orgId =
    (session.metadata?.cliste_organization_id ?? "").trim() || null;
  if (!orgId) return;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  await admin
    .from("organizations")
    .update({
      platform_subscription_id: subscriptionId,
      platform_customer_id: customerId,
      onboarding_step: 4,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);
}

async function handlePlatformSubscriptionChange(
  admin: AdminClient,
  sub: Stripe.Subscription,
) {
  const orgId =
    (sub.metadata?.cliste_organization_id ?? "").trim() || null;
  if (!orgId) return;

  const isHealthy =
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due";
  const shouldSuspend =
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired" ||
    sub.status === "canceled";

  const { data: org } = await admin
    .from("organizations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();
  const currentStatus = (org?.status as string | undefined) ?? "active";

  const patch: Record<string, unknown> = {
    platform_subscription_id: sub.id,
    platform_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    updated_at: new Date().toISOString(),
  };

  if (shouldSuspend && currentStatus === "active") {
    patch.status = "suspended";
    patch.is_active = false;
    patch.suspended_reason = `stripe_subscription_${sub.status}`;
    patch.suspended_at = new Date().toISOString();
  } else if (isHealthy && currentStatus === "suspended") {
    patch.status = "active";
    patch.is_active = true;
    patch.suspended_reason = null;
    patch.suspended_at = null;
  }

  await admin.from("organizations").update(patch).eq("id", orgId);
}

async function handlePlatformSubscriptionDeleted(
  admin: AdminClient,
  sub: Stripe.Subscription,
) {
  const orgId =
    (sub.metadata?.cliste_organization_id ?? "").trim() || null;
  if (!orgId) return;
  await admin
    .from("organizations")
    .update({
      status: "churned",
      is_active: false,
      suspended_reason: "platform_subscription_cancelled",
      suspended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);
}

/** Supabase-js can return joined rows as either an object or an array when
 *  the relationship is ambiguous. Normalise to the first element either way. */
function pickJoined<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return v;
}
