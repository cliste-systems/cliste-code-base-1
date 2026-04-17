"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Resolve an absolute origin for Connect redirect URLs. Prefers the configured
 * `NEXT_PUBLIC_APP_URL`; falls back to the incoming request host so local dev
 * (`localhost:3000`) works with Stripe sandbox.
 */
async function resolveReturnOrigin(): Promise<string> {
  const configured = resolveAppSiteOrigin();
  if (configured) return configured.origin;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

/**
 * Start (or resume) Stripe Connect Express onboarding for the salon attached
 * to the current dashboard session. Creates an Express account if missing and
 * returns an Account Link that we immediately redirect the operator to.
 */
export async function startStripeConnectOnboarding(): Promise<never> {
  const { supabase, organizationId } = await requireDashboardSession();
  const stripe = getStripeClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, stripe_account_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org) throw new Error("No organisation on this session.");

  let accountId = org.stripe_account_id?.trim() || null;

  if (!accountId) {
    const created = await stripe.accounts.create({
      type: "express",
      country: "IE",
      default_currency: "eur",
      business_profile: {
        name: org.name ?? undefined,
        product_description:
          "Salon bookings accepted via Cliste Systems (https://clistesystems.ie).",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { cliste_organization_id: organizationId },
    });
    accountId = created.id;

    // Service role write: the operator's RLS policy may not allow writing
    // these columns on `organizations`. This function already proved they
    // have operator access via `requireDashboardSession`.
    const admin = createAdminClient();
    const { error: updErr } = await admin
      .from("organizations")
      .update({ stripe_account_id: accountId })
      .eq("id", organizationId);
    if (updErr) throw new Error(updErr.message);
  }

  const origin = await resolveReturnOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/dashboard/payments?refresh=1`,
    return_url: `${origin}/dashboard/payments?status=return`,
  });

  // Fire-and-forget revalidation (we're about to redirect off-site anyway).
  revalidatePath("/dashboard/payments");
  redirect(link.url);
}

/**
 * Fetch the latest account capabilities from Stripe and persist them. Call on
 * dashboard page load when `?status=return` is present so the UI updates
 * immediately even if the webhook hasn't landed yet.
 */
export async function syncStripeConnectStatus(): Promise<void> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, stripe_account_id, stripe_onboarded_at")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org?.stripe_account_id) return;

  const stripe = getStripeClient();
  const acct = await stripe.accounts.retrieve(org.stripe_account_id);
  const detailsSubmitted = Boolean(acct.details_submitted);
  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);

  const admin = createAdminClient();
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
    })
    .eq("id", organizationId);

  revalidatePath("/dashboard/payments");
}

/**
 * Returns a signed Stripe Express dashboard login link for the connected
 * account so the operator can manage payouts / payments directly on Stripe.
 */
export async function openStripeExpressDashboard(): Promise<never> {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_account_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org?.stripe_account_id) {
    throw new Error("Connect Stripe first.");
  }
  const stripe = getStripeClient();
  const link = await stripe.accounts.createLoginLink(org.stripe_account_id);
  redirect(link.url);
}
