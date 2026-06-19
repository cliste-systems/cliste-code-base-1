import "server-only";

/**
 * Dev-only onboarding bypass — jump to any `/onboarding/*` step without guards.
 *
 * Enable locally: `CLISTE_ONBOARDING_FREE_NAV=true` in `.env.local`
 *
 * **Never set in production.** This flag is ignored when `NODE_ENV=production`.
 */
export function isOnboardingFreeNavEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_ONBOARDING_FREE_NAV === "true";
}

/**
 * Dev-only: relax signup + onboarding friction for local QA.
 *
 * Skips Turnstile, auth rate limits, fraud review queue, and voice API rate
 * limits. Pair with:
 *   CLISTE_ONBOARDING_FREE_NAV=true  — jump between onboarding steps
 *   CLISTE_ONBOARDING_PREVIEW=true   — unauthenticated plan/checkout preview
 *
 * Enable: `CLISTE_SIGNUP_ONBOARDING_DEV=true` in `.env.local`
 * Never set in production.
 */
export function isSignupOnboardingDevRelaxed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_SIGNUP_ONBOARDING_DEV === "true";
}

/** When false, onboarding pages enforce subscription + step-order redirects. */
export function enforceOnboardingStepOrder(): boolean {
  return !isOnboardingFreeNavEnabled();
}

/**
 * Local-only unauthenticated preview of onboarding screens (plan, Stripe checkout).
 *
 * Enable: `CLISTE_ONBOARDING_PREVIEW=true` in `.env.local`
 * Routes: `/dev/onboarding/plan`, `/dev/onboarding/plan/checkout`
 *
 * **Never set in production.** Ignored when `NODE_ENV=production`.
 */
export function isDevOnboardingPreviewEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_ONBOARDING_PREVIEW === "true";
}
