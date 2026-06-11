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

/** When false, onboarding pages enforce subscription + step-order redirects. */
export function enforceOnboardingStepOrder(): boolean {
  return !isOnboardingFreeNavEnabled();
}
