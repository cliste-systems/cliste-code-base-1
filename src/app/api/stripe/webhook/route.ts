import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { ONBOARDING_STEPS } from "@/lib/onboarding-session";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook for **Cliste platform billing** (salon subscriptions).
 * Customer booking PaymentIntents and Connect account sync were removed in v1.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  const rawBody = await req.text();

  let event: Stripe.Event;
  const stripe = getStripeClient();
  if (secret) {
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
      return new NextResponse("invalid signature", { status: 400 });
    }
  } else {
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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handlePlatformCheckoutCompleted(admin, session);
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
      : (session.subscription?.id ?? null);
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  // Payment is the final go-live step now: activate the org on successful checkout.
  await admin
    .from("organizations")
    .update({
      platform_subscription_id: subscriptionId,
      platform_customer_id: customerId,
      status: "active",
      is_active: true,
      onboarding_step: ONBOARDING_STEPS.done,
      launch_status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  try {
    const phoneResult = await provisionOrganizationPhoneNumber(orgId);
    if (!phoneResult.ok) {
      console.warn(
        "[stripe webhook] phone provision failed",
        orgId,
        phoneResult.message,
      );
    }
  } catch (err) {
    console.error("[stripe webhook] phone provision error", orgId, err);
  }
}

async function handlePlatformSubscriptionChange(
  admin: AdminClient,
  sub: Stripe.Subscription,
) {
  const orgId = (sub.metadata?.cliste_organization_id ?? "").trim() || null;
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
  const orgId = (sub.metadata?.cliste_organization_id ?? "").trim() || null;
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
