/**
 * Pure data for Cliste platform plans + launches.
 *
 * This file is isomorphic: no `server-only`, no Next imports, no Supabase.
 * That lets the Node-based `scripts/stripe-bootstrap.ts` import it directly
 * under tsx while `src/lib/cliste-plans.ts` re-exports it for app code with
 * the `server-only` guard attached.
 */

export type PlanTier = "starter" | "pro" | "business" | "enterprise";
export type BillingInterval = "month" | "year";
export type LaunchTier = "diy" | "remote" | "onsite_dublin" | "onsite_rest_ie";

export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyCents: number;
  annualCents: number;
  includedMinutes: number;
  overageRateCents: number;
  applicationFeeBps: number;
  features: string[];
  recommended?: boolean;
};

export const PLANS: Record<PlanTier, PlanDefinition> = {
  starter: {
    tier: "starter",
    name: "Starter",
    tagline: "Solo stylists, barbers, nail techs. One chair, no staff logins.",
    monthlyCents: 9900,
    annualCents: 9900 * 10,
    includedMinutes: 150,
    overageRateCents: 70,
    applicationFeeBps: 150,
    features: [
      "AI receptionist 24/7",
      "Calendar + service menu",
      "SMS confirmations + reminders",
      "Stripe Connect payments",
      "1 staff login",
      "150 AI call minutes/mo, €0.70/min after",
      "1.5% platform fee on card bookings",
    ],
  },
  pro: {
    tier: "pro",
    name: "Professional",
    tagline: "2–5 chair salons. The sweet spot for most independent salons.",
    monthlyCents: 24900,
    annualCents: 24900 * 10,
    includedMinutes: 500,
    overageRateCents: 55,
    applicationFeeBps: 100,
    recommended: true,
    features: [
      "Everything in Starter, plus:",
      "500 AI call minutes/mo, €0.55/min after",
      "1.0% platform fee on card bookings",
      "No-show deposits + cancellation policies",
      "Online payments + rebooking reminders",
      "Weekly performance email",
      "Up to 5 staff logins",
    ],
  },
  business: {
    tier: "business",
    name: "Business",
    tagline: "6+ chair salons, premium spas.",
    monthlyCents: 49900,
    annualCents: 49900 * 10,
    includedMinutes: 1500,
    overageRateCents: 40,
    applicationFeeBps: 50,
    features: [
      "Everything in Professional, plus:",
      "1,500 AI call minutes/mo, €0.40/min after",
      "0.5% platform fee on card bookings",
      "Quarterly AI prompt tuning with our team",
      "Priority phone support",
      "Unlimited staff logins",
      "Analytics dashboard",
    ],
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "Multi-location, chains, franchises. Talk to us.",
    monthlyCents: 99900,
    annualCents: 99900 * 10,
    includedMinutes: 4000,
    overageRateCents: 30,
    applicationFeeBps: 25,
    features: [
      "Everything in Business, plus:",
      "4,000+ AI call minutes/mo, €0.30/min after",
      "0.25% platform fee (negotiable)",
      "Multi-location routing",
      "Dedicated success manager",
      "Monthly AI tuning",
      "Custom voice branding + SSO",
    ],
  },
};

export type LaunchDefinition = {
  tier: LaunchTier;
  name: string;
  description: string;
  priceCents: number;
  targetRegion?: string;
};

export const LAUNCHES: Record<LaunchTier, LaunchDefinition> = {
  diy: {
    tier: "diy",
    name: "DIY Setup",
    description:
      "Self-serve wizard, per-carrier forwarding guides, no human contact. Live in under an hour.",
    priceCents: 0,
  },
  remote: {
    tier: "remote",
    name: "Remote Launch",
    description:
      "60-minute Zoom with a Cliste specialist. We co-write your AI prompt from your menu, walk through forwarding setup, run 3 test calls together.",
    priceCents: 14900,
  },
  onsite_dublin: {
    tier: "onsite_dublin",
    name: "On-Site Launch (Dublin + commuter belt)",
    description:
      "Specialist visits your salon: sets up forwarding on your phone, trains all staff, runs 10+ test calls, updates your Google Business Profile + Instagram.",
    priceCents: 34900,
    targetRegion: "Dublin, Kildare, Meath, Wicklow, Louth",
  },
  onsite_rest_ie: {
    tier: "onsite_rest_ie",
    name: "On-Site Launch (rest of Ireland)",
    description:
      "Specialist visits your salon. Same scope as the Dublin on-site launch; includes travel time + mileage for the rest of the country.",
    priceCents: 44900,
    targetRegion: "Cork, Galway, Limerick, Waterford, and anywhere else in Ireland",
  },
};

export function planFromPriceCents(cents: number): PlanTier | null {
  for (const p of Object.values(PLANS)) {
    if (p.monthlyCents === cents || p.annualCents === cents) return p.tier;
  }
  return null;
}

export function isPlanTier(value: unknown): value is PlanTier {
  return (
    typeof value === "string" &&
    (value === "starter" ||
      value === "pro" ||
      value === "business" ||
      value === "enterprise")
  );
}

export function isLaunchTier(value: unknown): value is LaunchTier {
  return (
    typeof value === "string" &&
    (value === "diy" ||
      value === "remote" ||
      value === "onsite_dublin" ||
      value === "onsite_rest_ie")
  );
}

export function normaliseLaunchTierForDb(
  t: LaunchTier,
): "diy" | "remote" | "onsite" {
  if (t === "diy") return "diy";
  if (t === "remote") return "remote";
  return "onsite";
}
