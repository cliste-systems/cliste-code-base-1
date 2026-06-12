import "server-only";

import Stripe from "stripe";

/**
 * Shared Stripe server client for Cliste platform billing (subscriptions,
 * Billing Portal). Salon customer Connect / booking PaymentIntents were removed in v1.
 */
let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (or the hosting env).",
    );
  }
  cachedClient = new Stripe(secret, {
    // Pin the API version so behaviour is stable across Stripe SDK upgrades.
    // (Stripe advances its Basil series through 2025→2026; see docs.)
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
    appInfo: {
      name: "Cliste Systems",
      url: "https://clistesystems.ie",
    },
  });
  return cachedClient;
}

export function stripeIsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
