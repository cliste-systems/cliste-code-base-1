/**
 * Self-serve signup is frozen for the retail pilot: tenants are provisioned by
 * Cliste from /admin and invited by email. The whole /signup + /onboarding
 * flow is kept intact behind this flag so it can be re-enabled later by
 * setting PUBLIC_SIGNUP_ENABLED=true.
 */
export function isPublicSignupEnabled(): boolean {
  const v = process.env.PUBLIC_SIGNUP_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
