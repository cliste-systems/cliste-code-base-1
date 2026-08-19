import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";

import type { AccountBillingRow, AccountLocationRow } from "@/lib/account-locations";
import { isPlanTier } from "@/lib/cliste-plans";
import { isLocalDashboardPreviewEnabled, supabaseServiceRoleLooksConfigured } from "@/lib/dashboard-dev";
import {
  OFFLINE_PREVIEW_ACCOUNT_ID,
  offlinePreviewBilling,
  offlinePreviewLocations,
} from "@/lib/dashboard-offline-preview";

export async function loadAccountLocations(
  accountId: string,
): Promise<AccountLocationRow[]> {
  if (
    isLocalDashboardPreviewEnabled() &&
    accountId === OFFLINE_PREVIEW_ACCOUNT_ID &&
    !supabaseServiceRoleLooksConfigured()
  ) {
    return offlinePreviewLocations();
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, slug, is_primary_location, phone_number, status")
      .eq("account_id", accountId)
      .order("is_primary_location", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      return data.map((row) => ({
        id: row.id as string,
        name: (row.name as string | null) ?? null,
        slug: (row.slug as string | null) ?? null,
        isPrimaryLocation: Boolean(row.is_primary_location),
        phoneNumber: (row.phone_number as string | null) ?? null,
        status: (row.status as string | null) ?? null,
      }));
    }
    if (error) {
      console.error("[account] load locations failed", error.message);
    }
  } catch (error) {
    console.error("[account] load locations failed", error);
  }

  if (
    isLocalDashboardPreviewEnabled() &&
    accountId === OFFLINE_PREVIEW_ACCOUNT_ID
  ) {
    return offlinePreviewLocations();
  }
  return [];
}

export async function loadAccountBilling(
  accountId: string,
): Promise<AccountBillingRow | null> {
  if (
    isLocalDashboardPreviewEnabled() &&
    accountId === OFFLINE_PREVIEW_ACCOUNT_ID &&
    !supabaseServiceRoleLooksConfigured()
  ) {
    return offlinePreviewBilling();
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("accounts")
      .select(
        "id, name, plan_tier, platform_customer_id, platform_subscription_id, billing_period_start, billing_interval, status",
      )
      .eq("id", accountId)
      .maybeSingle();

    if (!error && data) {
      const planTier = isPlanTier(data.plan_tier) ? data.plan_tier : "pro";
      return {
        id: data.id as string,
        name: (data.name as string | null) ?? null,
        planTier,
        platformCustomerId: (data.platform_customer_id as string | null) ?? null,
        platformSubscriptionId:
          (data.platform_subscription_id as string | null) ?? null,
        billingPeriodStart: (data.billing_period_start as string | null) ?? null,
        billingInterval: data.billing_interval === "year" ? "year" : "month",
        status: (data.status as string | null) ?? null,
      };
    }
    if (error) console.error("[account] load billing failed", error.message);
  } catch (error) {
    console.error("[account] load billing failed", error);
  }

  if (
    isLocalDashboardPreviewEnabled() &&
    accountId === OFFLINE_PREVIEW_ACCOUNT_ID
  ) {
    return offlinePreviewBilling();
  }
  return null;
}

export async function countAccountLocations(accountId: string): Promise<number> {
  if (
    isLocalDashboardPreviewEnabled() &&
    accountId === OFFLINE_PREVIEW_ACCOUNT_ID &&
    !supabaseServiceRoleLooksConfigured()
  ) {
    return 1;
  }
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);

  if (error) {
    console.error("[account] count locations failed", error.message);
    return 1;
  }
  return count ?? 1;
}
