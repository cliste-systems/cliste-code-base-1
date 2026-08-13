import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/** Stripe Clover+ injects a sandbox "testing assistant" pill unless disabled. */
const STRIPE_JS_OPTIONS = {
  developerTools: {
    assistant: {
      enabled: false,
    },
  },
} as const;

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
    stripePromise = loadStripe(key, STRIPE_JS_OPTIONS);
  }
  return stripePromise;
}
