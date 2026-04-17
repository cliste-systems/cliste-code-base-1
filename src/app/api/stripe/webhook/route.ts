import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
// Stripe needs the raw body bytes for signature verification, so caching
// (and any middleware transformation) must stay off this route.
export const dynamic = "force-dynamic";

/**
 * Stripe Connect webhook.
 *
 * Events we care about:
 * - `checkout.session.completed` → booking paid. Upsert `payment_status='paid'`
 *   on the matching appointment (we set `metadata.appointment_id` when we
 *   create the Session).
 * - `checkout.session.async_payment_succeeded` → like above for delayed
 *   methods.
 * - `checkout.session.expired` → mark pending booking back to `unpaid` so the
 *   client can try again.
 * - `account.updated` → sync the connected account's capabilities onto the
 *   organisation row (used to decide whether to show the "Continue" card on
 *   `/dashboard/payments`).
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
    // Production MUST set the secret; we log loudly either way.
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
        // Ignore everything else; Stripe will keep retrying only if we 5xx.
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", event.type, err);
    // Return 500 so Stripe retries (idempotent handlers below).
    return new NextResponse("handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// GET is handy when eyeballing the endpoint in a browser or during ngrok setup.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe-webhook" });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function markAppointmentPaidFromSession(
  admin: AdminClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const appointmentId =
    (session.metadata?.appointment_id ?? "").trim() || null;
  if (!appointmentId) {
    console.warn(
      "[stripe webhook] checkout.session.completed without appointment_id metadata",
      session.id,
    );
    return;
  }

  // Expand the payment intent once so we can store the charge id for refunds.
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
    } catch (err) {
      console.warn(
        "[stripe webhook] could not expand payment intent",
        paymentIntentId,
        err,
      );
    }
  } else if (session.payment_intent && typeof session.payment_intent === "object") {
    paymentIntentId = session.payment_intent.id;
  }

  const paidAt = new Date().toISOString();
  const amountCents =
    typeof session.amount_total === "number" ? session.amount_total : null;
  const currency = session.currency?.toLowerCase() ?? null;

  const { error } = await admin
    .from("appointments")
    .update({
      payment_status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      ...(amountCents != null ? { amount_cents: amountCents } : {}),
      ...(currency ? { currency } : {}),
    })
    .eq("id", appointmentId);

  if (error) {
    // Throw so Stripe retries — typical cause is a transient Supabase error.
    throw new Error(`update appointment paid: ${error.message}`);
  }

  // Refresh operator pages that list appointments/payments.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
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
  // `id` is always present on Account objects.
  if (!acct.id) return;

  const detailsSubmitted = Boolean(acct.details_submitted);
  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);

  const { data: existing } = await admin
    .from("organizations")
    .select("id, stripe_onboarded_at")
    .eq("stripe_account_id", acct.id)
    .maybeSingle();

  if (!existing) {
    // Account exists on Stripe but no organisation claims it (e.g. dev noise).
    // Ignore — we only attach `stripe_account_id` ourselves in the onboarding
    // action.
    return;
  }

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
