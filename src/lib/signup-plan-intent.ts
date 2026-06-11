import type { BillingInterval, PlanTier } from "./cliste-plans.data";
import { isPlanTier } from "./cliste-plans.data";

/** Query keys used by the marketing site → app deep links. */
export const SIGNUP_PLAN_QUERY_KEYS = ["plan", "interval"] as const;

const PLAN_ALIASES: Record<string, PlanTier> = {
  starter: "starter",
  pro: "pro",
  professional: "pro",
  business: "business",
  enterprise: "enterprise",
  custom: "enterprise",
};

/**
 * Parse ?plan=starter&interval=month from marketing CTAs.
 * Returns null when missing or invalid (caller picks a default).
 */
export function parseMarketingPlanIntent(input: {
  plan?: string | string[] | null;
  interval?: string | string[] | null;
}): { planTier: PlanTier | null; interval: BillingInterval } {
  const rawPlan = Array.isArray(input.plan) ? input.plan[0] : input.plan;
  const rawInterval = Array.isArray(input.interval) ? input.interval[0] : input.interval;

  const normalised = rawPlan?.trim().toLowerCase() ?? "";
  const mapped = PLAN_ALIASES[normalised];
  const planTier =
    mapped ?? (isPlanTier(normalised) ? (normalised as PlanTier) : null);

  const interval: BillingInterval =
    rawInterval?.trim().toLowerCase() === "year" ? "year" : "month";

  return { planTier, interval };
}

export function planIntentLabel(planTier: PlanTier): string {
  switch (planTier) {
    case "starter":
      return "Starter";
    case "pro":
      return "Professional";
    case "business":
      return "Business";
    case "enterprise":
      return "Custom";
    default:
      return planTier;
  }
}

/** Marketing site CTAs → app signup with plan pre-selected. */
export function signupUrlForPlan(
  planTier: PlanTier,
  interval: BillingInterval = "month",
): string {
  const slug =
    planTier === "enterprise"
      ? "custom"
      : planTier === "pro"
        ? "professional"
        : planTier;
  const params = new URLSearchParams({ plan: slug, interval });
  return `/signup?${params.toString()}`;
}
