/** Common mistyped auth URLs → canonical sign-in. */
export const LEGACY_AUTH_REDIRECTS: Record<string, string> = {
  "/signin": "/authenticate",
  "/sign-in": "/authenticate",
};
