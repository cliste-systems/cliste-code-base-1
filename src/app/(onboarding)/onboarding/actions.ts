"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createGateCookieValue,
  DASHBOARD_GATE_COOKIE_PREFIX,
  DEFAULT_GATE_TTL_SECONDS,
} from "@/lib/gate-cookie";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import {
  isLaunchTier,
  isPlanTier,
  LAUNCHES,
  normaliseLaunchTierForDb,
  PLANS,
  type LaunchTier,
  type PlanTier,
} from "@/lib/cliste-plans";
import { geocodeIrelandLocation } from "@/lib/geocode-ireland";
import {
  type OrganizationNiche,
  isOrganizationNiche,
} from "@/lib/organization-niche";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { assignFromPool } from "@/lib/phone-pool";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Step 1 — capture salon profile details used for the AI prompt and the
 * public storefront. Address is geocoded (Ireland) so the directory search
 * can sort by distance.
 */
export async function saveProfileStep(
  _: unknown,
  formData: FormData,
): Promise<SaveProfileResult> {
  const session = await requireOnboardingSession();

  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "hair_salon");
  const address = String(formData.get("address") ?? "").trim();
  const eircode = String(formData.get("eircode") ?? "").trim();
  const greeting = String(formData.get("greeting") ?? "").trim();

  if (name.length < 2) {
    return { ok: false, message: "Salon name is too short." };
  }
  const safeNiche: OrganizationNiche = isOrganizationNiche(niche)
    ? niche
    : "hair_salon";

  let lat: number | null = null;
  let lng: number | null = null;
  const geoQuery = [address, eircode].filter(Boolean).join(", ");
  if (geoQuery) {
    const g = await geocodeIrelandLocation(geoQuery);
    if (g) {
      lat = g.lat;
      lng = g.lng;
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      name,
      niche: safeNiche,
      address: address || null,
      storefront_eircode: eircode || null,
      storefront_map_lat: lat,
      storefront_map_lng: lng,
      greeting: greeting || null,
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/payments");
}

/**
 * Step 2 is the existing Stripe Connect flow — we redirect into the
 * same server action used by the dashboard so there's one code path.
 */
export async function startStripeConnectFromOnboarding(): Promise<never> {
  const session = await requireOnboardingSession();
  const stripe = getStripeClient();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, stripe_account_id")
    .eq("id", session.organizationId)
    .maybeSingle();

  let accountId = (org?.stripe_account_id as string | null)?.trim() || null;
  if (!accountId) {
    const created = await stripe.accounts.create({
      type: "express",
      country: "IE",
      default_currency: "eur",
      business_profile: {
        name: (org?.name as string) ?? undefined,
        product_description:
          "Salon bookings accepted via Cliste Systems (https://clistesystems.ie).",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { cliste_organization_id: session.organizationId },
    });
    accountId = created.id;
    await admin
      .from("organizations")
      .update({ stripe_account_id: accountId })
      .eq("id", session.organizationId);
  }

  const origin = await resolveReturnOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/onboarding/payments?refresh=1`,
    return_url: `${origin}/onboarding/payments?status=return`,
  });

  redirect(link.url);
}

/**
 * Step 2 finisher — called when the Connect Express flow redirects back.
 * Persists the latest charges/payouts booleans onto the org row, so the
 * wizard's gating logic (requireOnboardingSession → resolveCurrentStepPath)
 * can move them forward.
 */
export async function syncConnectAfterReturn(): Promise<void> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("stripe_account_id, stripe_onboarded_at")
    .eq("id", session.organizationId)
    .maybeSingle();
  if (!org?.stripe_account_id) return;

  const stripe = getStripeClient();
  const acct = await stripe.accounts.retrieve(
    org.stripe_account_id as string,
  );
  const detailsSubmitted = Boolean(acct.details_submitted);
  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);
  const shouldSetOnboardedAt =
    chargesEnabled && detailsSubmitted && !org.stripe_onboarded_at;

  await admin
    .from("organizations")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: detailsSubmitted,
      ...(shouldSetOnboardedAt
        ? { stripe_onboarded_at: new Date().toISOString() }
        : {}),
      onboarding_step: chargesEnabled ? 3 : 2,
    })
    .eq("id", session.organizationId);
}

/**
 * Step 3 — create a Stripe Billing Checkout Session that charges:
 *   - the selected plan's monthly or annual price (licensed line)
 *   - a metered price for per-minute overage (licensed=false line, quantity
 *     grows via usage_records nightly sync)
 *   - a one-off invoice item for the launch tier (if not DIY)
 *
 * Returns the Checkout URL. Webhook will set organizations.platform_subscription_id
 * on `customer.subscription.created` / `.updated`.
 */
export async function startPlanCheckout(
  _: unknown,
  formData: FormData,
): Promise<{ ok: false; message: string }> {
  const session = await requireOnboardingSession();

  const rawPlan = String(formData.get("planTier") ?? "").trim();
  const rawLaunch = String(formData.get("launchTier") ?? "").trim();
  const interval = String(formData.get("interval") ?? "month") === "year" ? "year" : "month";

  if (!isPlanTier(rawPlan)) {
    return { ok: false, message: "Pick a plan to continue." };
  }
  if (!isLaunchTier(rawLaunch)) {
    return { ok: false, message: "Pick a launch option." };
  }
  const planTier: PlanTier = rawPlan;
  const launchTier: LaunchTier = rawLaunch;

  const admin = createAdminClient();
  // Save the selection first so refreshes don't reset the wizard.
  await admin
    .from("organizations")
    .update({
      plan_tier: planTier,
      launch_tier: normaliseLaunchTierForDb(launchTier),
      billing_interval: interval,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  // Look up the Stripe price IDs seeded by scripts/stripe-bootstrap.ts.
  const planKey =
    interval === "year"
      ? `cliste_plan_${planTier}_annual`
      : `cliste_plan_${planTier}_monthly`;
  const overageKey = `cliste_plan_${planTier}_overage_min`;
  const wantedKeys = [planKey, overageKey];
  if (launchTier !== "diy") {
    wantedKeys.push(`cliste_setup_${launchTier}_once`);
  }

  const { data: priceRows } = await admin
    .from("stripe_platform_prices")
    .select("key, stripe_price_id")
    .in("key", wantedKeys)
    .eq("active", true);

  const priceMap = new Map<string, string>();
  for (const r of priceRows ?? []) {
    priceMap.set(r.key as string, r.stripe_price_id as string);
  }

  const planPriceId = priceMap.get(planKey);
  const overagePriceId = priceMap.get(overageKey);
  if (!planPriceId || !overagePriceId) {
    return {
      ok: false,
      message:
        "Pricing isn't configured yet. Run `npm run stripe:bootstrap` from the app repo and refresh.",
    };
  }

  const stripe = getStripeClient();
  const origin = await resolveReturnOrigin();

  // Recurring line items for the subscription itself. The metered overage
  // price is meter-backed so it gets no quantity; Stripe fills usage from
  // the meter at the end of each billing period.
  const lineItems: Array<{ price: string; quantity?: number }> = [
    { price: planPriceId, quantity: 1 },
    { price: overagePriceId },
  ];

  // One-off setup fees are added to the FIRST invoice via
  // subscription_data.add_invoice_items — Stripe Checkout in subscription
  // mode rejects one-time prices inside line_items.
  const addInvoiceItems: Array<{ price: string; quantity?: number }> = [];
  if (launchTier !== "diy") {
    const setupPriceId = priceMap.get(`cliste_setup_${launchTier}_once`);
    if (setupPriceId) {
      addInvoiceItems.push({ price: setupPriceId, quantity: 1 });
    }
  }

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      customer_email: session.user.email ?? undefined,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          cliste_organization_id: session.organizationId,
          cliste_plan_tier: planTier,
          cliste_launch_tier: launchTier,
        },
        ...(addInvoiceItems.length > 0
          ? { add_invoice_items: addInvoiceItems }
          : {}),
      },
      metadata: {
        cliste_organization_id: session.organizationId,
        cliste_plan_tier: planTier,
        cliste_launch_tier: launchTier,
      },
      success_url: `${origin}/onboarding/plan?status=return&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding/plan?status=cancel`,
    });

    if (checkout.url) {
      redirect(checkout.url);
    }
    return { ok: false, message: "Stripe did not return a Checkout URL." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    console.error("[onboarding] plan checkout failed", err);
    return { ok: false, message };
  }
}

/**
 * Step 3 return handler — after Stripe Checkout success, fetch the session,
 * persist the subscription id + customer id, and advance the wizard.
 */
export async function finalisePlanCheckout(checkoutSessionId: string): Promise<void> {
  const session = await requireOnboardingSession();
  if (!checkoutSessionId?.trim()) return;

  const stripe = getStripeClient();
  const co = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription", "subscription.items.data.price", "customer"],
  });
  if (co.metadata?.cliste_organization_id !== session.organizationId) {
    throw new Error("Checkout session does not belong to this organisation.");
  }

  const subscriptionId =
    typeof co.subscription === "string"
      ? co.subscription
      : co.subscription?.id ?? null;
  const customerId =
    typeof co.customer === "string" ? co.customer : co.customer?.id ?? null;

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      platform_subscription_id: subscriptionId,
      platform_customer_id: customerId,
      onboarding_step: 4,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);
}

/**
 * Step 4 — claim an Irish DID from the pool. Single-button action.
 */
export async function pickNumberFromPool(): Promise<
  { ok: true; e164: string } | { ok: false; message: string }
> {
  const session = await requireOnboardingSession();
  if (session.phoneNumber) {
    return { ok: true, e164: session.phoneNumber };
  }

  const result = await assignFromPool(session.organizationId, "IE");
  if (!result.ok) return result;

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      onboarding_step: 5,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  return { ok: true, e164: result.e164 };
}

/**
 * Step 5 — salon confirms they heard the AI answer the test call. Flips
 * status='active' and is_active=true so the salon starts accepting bookings.
 */
export async function completeOnboarding(): Promise<void> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();

  await admin
    .from("organizations")
    .update({
      status: "active",
      is_active: true,
      onboarding_step: 5,
      launch_status:
        session.launchTier === "diy" ? "completed" : "scheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  // Mint the dashboard gate cookie so self-serve signups can walk straight
  // into the dashboard without bumping into the shared staff password.
  // CLISTE_DASHBOARD_GATE_SECRET must be set in the env; without it, the
  // legacy gate redirects everyone to /dashboard-unlock?error=config.
  const gateSecret = process.env.CLISTE_DASHBOARD_GATE_SECRET?.trim();
  if (gateSecret) {
    try {
      const value = await createGateCookieValue(
        DASHBOARD_GATE_COOKIE_PREFIX,
        gateSecret,
      );
      (await cookies()).set("cliste_dashboard_gate", value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: DEFAULT_GATE_TTL_SECONDS,
      });
    } catch (err) {
      console.warn(
        "[onboarding] could not mint dashboard gate cookie",
        err instanceof Error ? err.message : err,
      );
    }
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard?welcome=1");
}

async function resolveReturnOrigin(): Promise<string> {
  const configured = resolveAppSiteOrigin();
  if (configured) return configured.origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
