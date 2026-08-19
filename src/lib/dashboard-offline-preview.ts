import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountBillingRow, AccountLocationRow } from "@/lib/account-locations";

/** Stable local-only IDs so layout queries stay consistent without a database. */
export const OFFLINE_PREVIEW_PROFILE_ID =
  "00000000-0000-4000-a000-dashboardunlock01";
export const OFFLINE_PREVIEW_ACCOUNT_ID =
  "00000000-0000-4000-a000-dashboardunlock02";
export const OFFLINE_PREVIEW_ORG_ID =
  "00000000-0000-4000-a000-dashboardunlock03";

export const OFFLINE_PREVIEW_ORG = {
  id: OFFLINE_PREVIEW_ORG_ID,
  account_id: OFFLINE_PREVIEW_ACCOUNT_ID,
  name: "Bloom Beauty Studio",
  slug: "bloom-beauty-studio",
  niche: "hair_salon",
  agent_business_type: "Hair salon",
  status: "active",
  tier: "starter",
  is_primary_location: true,
  phone_number: null,
  plan_tier: "starter",
} as const;

export const OFFLINE_PREVIEW_ACCOUNT = {
  id: OFFLINE_PREVIEW_ACCOUNT_ID,
  name: "Bloom Beauty Studio",
  plan_tier: "starter",
  platform_customer_id: null,
  platform_subscription_id: null,
  billing_period_start: null,
  billing_interval: "month",
  status: "active",
} as const;

export function offlinePreviewLocations(): AccountLocationRow[] {
  return [
    {
      id: OFFLINE_PREVIEW_ORG_ID,
      name: OFFLINE_PREVIEW_ORG.name,
      slug: OFFLINE_PREVIEW_ORG.slug,
      isPrimaryLocation: true,
      phoneNumber: null,
      status: "active",
    },
  ];
}

export function offlinePreviewBilling(): AccountBillingRow {
  return {
    id: OFFLINE_PREVIEW_ACCOUNT_ID,
    name: OFFLINE_PREVIEW_ACCOUNT.name,
    planTier: "starter",
    platformCustomerId: null,
    platformSubscriptionId: null,
    billingPeriodStart: null,
    billingInterval: "month",
    status: "active",
  };
}

type QueryResult = {
  data: unknown;
  error: null;
  count: number;
};

function resultForTable(table: string): { list: QueryResult; single: unknown } {
  if (table === "organizations") {
    return {
      list: { data: [OFFLINE_PREVIEW_ORG], error: null, count: 1 },
      single: OFFLINE_PREVIEW_ORG,
    };
  }
  if (table === "accounts") {
    return {
      list: { data: [OFFLINE_PREVIEW_ACCOUNT], error: null, count: 1 },
      single: OFFLINE_PREVIEW_ACCOUNT,
    };
  }
  return { list: { data: [], error: null, count: 0 }, single: null };
}

export function createOfflinePreviewQuery(table: string) {
  const { list, single } = resultForTable(table);
  const builder: Record<string, unknown> = {};
  const proxy = new Proxy(builder, {
    get(_target, prop) {
      if (prop === "then") {
        return (
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(list).then(resolve, reject);
      }
      if (prop === "maybeSingle" || prop === "single") {
        return async () => ({
          data: single,
          error: null,
          count: single ? 1 : 0,
        });
      }
      return () => proxy;
    },
  });
  return proxy;
}

export function createOfflinePreviewSupabase(): SupabaseClient {
  return {
    from: (table: string) => createOfflinePreviewQuery(table),
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
}
