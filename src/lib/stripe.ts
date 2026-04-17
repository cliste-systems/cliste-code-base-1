import "server-only";

import Stripe from "stripe";

/**
 * Shared Stripe server client.
 *
 * We use Stripe Connect in the **Platform** model:
 * - Each salon has its own **Express connected account** (`acct_…`) stored on
 *   `organizations.stripe_account_id`.
 * - Booking payments are **destination charges** created on the *platform*
 *   account with `transfer_data.destination = <connected account>`; the platform
 *   takes an `application_fee_amount`.
 * - Webhook events therefore land on the platform account endpoint
 *   (`/api/stripe/webhook`), not per-connected-account — simpler for MVP.
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

/**
 * Platform fee in basis points (500 = 5.00%). Can be overridden per
 * deployment via `CLISTE_STRIPE_APPLICATION_FEE_BPS`.
 */
export function getApplicationFeeBps(): number {
  const raw = process.env.CLISTE_STRIPE_APPLICATION_FEE_BPS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
    // Sensible default + guard against absurd values (max 50%).
    return 500;
  }
  return parsed;
}

export function getDefaultCurrency(): string {
  const raw = process.env.CLISTE_STRIPE_CURRENCY?.trim().toLowerCase();
  if (!raw) return "eur";
  // Stripe accepts lowercase 3-letter ISO 4217. We keep a light whitelist.
  if (!/^[a-z]{3}$/.test(raw)) return "eur";
  return raw;
}

/**
 * Rounds a decimal amount (e.g. 40.00) into minor units (4000).
 * Used when converting `services.price` (numeric) into Stripe cents.
 */
export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function computeApplicationFeeCents(
  amountCents: number,
  feeBps: number = getApplicationFeeBps(),
): number {
  if (amountCents <= 0 || feeBps <= 0) return 0;
  // Cap fee at the charge amount to avoid Stripe validation errors on tiny
  // charges; realistically the charge minimum (~€0.50) makes this a non-issue.
  return Math.min(amountCents, Math.floor((amountCents * feeBps) / 10_000));
}
