import "server-only";

/**
 * Cliste platform pricing — the one source of truth.
 *
 * Thin re-export of the pure-data module `cliste-plans.data` with the
 * `server-only` guard attached for Next/RSC callers. Scripts (like
 * `scripts/stripe-bootstrap.ts`) that run under plain Node should import
 * from `./cliste-plans.data` directly to avoid pulling in `server-only`.
 */

export type {
  PlanTier,
  BillingInterval,
  LaunchTier,
  PlanDefinition,
  LaunchDefinition,
} from "./cliste-plans.data";

export {
  PLANS,
  LAUNCHES,
  planFromPriceCents,
  isPlanTier,
  isLaunchTier,
  normaliseLaunchTierForDb,
} from "./cliste-plans.data";
