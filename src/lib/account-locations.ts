import "server-only";

import type { PlanTier } from "@/lib/cliste-plans";

/** Cookie mirroring profiles.active_organization_id for middleware. */
export const ACTIVE_ORGANIZATION_COOKIE = "cliste_active_org";

/** When "1", dashboard home and usage aggregate across every location. */
export const ALL_LOCATIONS_VIEW_COOKIE = "cliste_view_all";

export type AccountLocationRow = {
  id: string;
  name: string | null;
  slug: string | null;
  isPrimaryLocation: boolean;
  phoneNumber: string | null;
  status: string | null;
};

export type AccountBillingRow = {
  id: string;
  name: string | null;
  planTier: PlanTier;
  platformCustomerId: string | null;
  platformSubscriptionId: string | null;
  billingPeriodStart: string | null;
  billingInterval: "month" | "year";
  status: string | null;
};

export function locationAddonQuantity(locationCount: number): number {
  return Math.max(0, locationCount - 1);
}

export function canAddLocation(planTier: PlanTier, locationCount: number): boolean {
  if (planTier === "business" || planTier === "enterprise") {
    return true;
  }
  return locationCount < 1;
}

export function locationLabelForVertical(verticalId: string): string {
  return verticalId === "salon_beauty" ? "Location" : "Site";
}
