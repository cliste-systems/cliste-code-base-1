import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function stripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}

export function stripePublishableConfigured(): boolean {
  return Boolean(stripePublishableKey());
}

export function getStripeJs(): Promise<Stripe | null> {
  const key = stripePublishableKey();
  if (!key) return Promise.resolve(null);
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
