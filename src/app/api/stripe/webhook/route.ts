import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import {
  activatePlatformSubscriptionGoLive,
  assertWebhookPlatformCheckoutSessionComplete,
} from "@/lib/platform-billing-checkout";
import {
  patchAccountAndLocations,
  resolveAccountIdFromBillingMetadata,
} from "@/lib/account-billing";
import { captureObservedError } from "@/lib/observability";
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
    const allowUnsignedDevOnly =
      process.env.NODE_ENV !== "production" &&
      process.env.CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS === "1";
    if (!allowUnsignedDevOnly) {
      console.error(
        "[stripe webhook] STRIPE_WEBHOOK_SECRET not set — rejecting. Set CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1 for local fixture testing only (non-production).",
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

  const { data: dedupeRow, error: dedupeErr } = await admin
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type })
    .select("event_id")
    .maybeSingle();
  if (dedupeErr) {
    if (dedupeErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await captureObservedError(dedupeErr, {
      route: "stripe/webhook",
      eventId: event.id,
    });
    return new NextResponse("dedupe error", { status: 500 });
  }
  if (!dedupeRow) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handlePlatformCheckoutCompleted(session);
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
    await captureObservedError(err, {
      route: "stripe/webhook",
      eventType: event.type,
      eventId: event.id,
    });
    return new NextResponse("handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe-webhook" });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handlePlatformCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  assertWebhookPlatformCheckoutSessionComplete(session);

  const orgId =
    (session.metadata?.cliste_organization_id ?? "").trim() || null;
  const accountId = await resolveAccountIdFromBillingMetadata({
    accountId: session.metadata?.cliste_account_id,
    organizationId: orgId,
  });
  if (!accountId || !orgId) return;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  await patchAccountAndLocations(
    accountId,
    {
      platform_subscription_id: subscriptionId,
      platform_customer_id: customerId,
      updated_at: new Date().toISOString(),
    },
    { primaryOrganizationId: orgId },
  );

  try {
    await activatePlatformSubscriptionGoLive(orgId);
  } catch (err) {
    await captureObservedError(err, {
      route: "stripe/webhook",
      sideEffect: "platform_go_live",
      orgId,
    });
  }
}

async function handlePlatformSubscriptionChange(
  admin: AdminClient,
  sub: Stripe.Subscription,
) {
  const orgId = (sub.metadata?.cliste_organization_id ?? "").trim() || null;
  const accountId = await resolveAccountIdFromBillingMetadata({
    accountId: sub.metadata?.cliste_account_id,
    organizationId: orgId,
  });
  if (!accountId) return;

  const isHealthy =
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due";
  const shouldSuspend =
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired" ||
    sub.status === "canceled";

  const { data: account } = await admin
    .from("accounts")
    .select("status")
    .eq("id", accountId)
    .maybeSingle();
  const currentStatus = (account?.status as string | undefined) ?? "active";

  const patch: Record<string, unknown> = {
    platform_subscription_id: sub.id,
    platform_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    updated_at: new Date().toISOString(),
  };

  if (shouldSuspend && currentStatus === "active") {
    patch.status = "suspended";
    patch.suspended_reason = `stripe_subscription_${sub.status}`;
    patch.suspended_at = new Date().toISOString();
  } else if (isHealthy && currentStatus === "suspended") {
    patch.status = "active";
    patch.suspended_reason = null;
    patch.suspended_at = null;
  }

  await patchAccountAndLocations(accountId, patch);
  if (shouldSuspend && currentStatus === "active") {
    await admin
      .from("organizations")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("account_id", accountId);
  } else if (isHealthy && currentStatus === "suspended") {
    await admin
      .from("organizations")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("account_id", accountId);
  }
}

async function handlePlatformSubscriptionDeleted(
  admin: AdminClient,
  sub: Stripe.Subscription,
) {
  const orgId = (sub.metadata?.cliste_organization_id ?? "").trim() || null;
  const accountId = await resolveAccountIdFromBillingMetadata({
    accountId: sub.metadata?.cliste_account_id,
    organizationId: orgId,
  });
  if (!accountId) return;
  await patchAccountAndLocations(accountId, {
    status: "churned",
    suspended_reason: "platform_subscription_cancelled",
    suspended_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await admin
    .from("organizations")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);
}
