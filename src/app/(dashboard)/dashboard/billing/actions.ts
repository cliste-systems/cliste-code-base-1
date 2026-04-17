"use server";

import Stripe from "stripe";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { requireDashboardSession } from "@/lib/dashboard-session";

/**
 * Mints a Stripe Billing Portal session so salon owners can update their
 * payment method / cancel / switch plans without leaving Cliste. Relies on
 * `organizations.platform_customer_id` being populated by the subscription
 * webhook — if it isn't yet, we return null and the UI hides the button.
 */
export async function openBillingPortal(): Promise<{ url: string } | null> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select("platform_customer_id")
    .eq("id", organizationId)
    .maybeSingle<{ platform_customer_id: string | null }>();

  const customerId = org?.platform_customer_id ?? null;
  if (!customerId) {
    return null;
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY not set.");
  }
  const stripe = new Stripe(secret, { apiVersion: "2026-03-25.dahlia" });

  const appOrigin = resolveAppSiteOrigin();
  const returnBase = appOrigin?.origin ?? "https://app.clistesystems.ie";
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${returnBase}/dashboard/billing`,
  });

  return { url: session.url };
}
