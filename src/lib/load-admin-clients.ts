import "server-only";

import {
  type ClientProvisionFilter,
  type ClientProvisionSource,
  isClientProvisionSource,
} from "@/lib/client-provision-source";
import { loadProvisioningStagesByOrgId } from "@/lib/load-provisioning-pipeline";
import type { TenantProvisioningStage } from "@/lib/tenant-provisioning-status";
import { createAdminClient } from "@/utils/supabase/admin";

export type AdminClientRow = {
  orgId: string;
  accountId: string | null;
  name: string;
  slug: string;
  niche: string | null;
  createdAt: string;
  provisionSource: ClientProvisionSource;
  accountStatus: string;
  onboardingStep: number | null;
  orgStatus: string | null;
  planTier: string | null;
  platformSubscriptionId: string | null;
  ownerEmail: string | null;
  provisioningStage: TenantProvisioningStage | null;
  phoneNumber: string | null;
};

type OrgRow = {
  id: string;
  account_id: string | null;
  name: string;
  slug: string;
  niche: string | null;
  created_at: string;
  status: string | null;
  onboarding_step: number | null;
  phone_number: string | null;
  is_primary_location: boolean | null;
  accounts:
    | {
        provision_source: string | null;
        status: string | null;
        plan_tier: string | null;
        platform_subscription_id: string | null;
      }
    | {
        provision_source: string | null;
        status: string | null;
        plan_tier: string | null;
        platform_subscription_id: string | null;
      }[]
    | null;
};

export async function loadAdminClients(
  filter: ClientProvisionFilter = "all",
): Promise<AdminClientRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("organizations")
    .select(
      `id, account_id, name, slug, niche, created_at, status, onboarding_step, phone_number, is_primary_location,
       accounts ( provision_source, status, plan_tier, platform_subscription_id )`,
    )
    .eq("is_primary_location", true)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const orgs = (data ?? []) as OrgRow[];
  const orgIds = orgs.map((o) => o.id);

  const [{ data: invites }, stageByOrg] = await Promise.all([
    admin
      .from("admin_invites")
      .select("organization_id, email")
      .in("organization_id", orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
    loadProvisioningStagesByOrgId(orgIds),
  ]);

  const inviteEmailByOrg = new Map<string, string>();
  for (const inv of invites ?? []) {
    const orgId = inv.organization_id as string;
    if (!inviteEmailByOrg.has(orgId)) {
      inviteEmailByOrg.set(orgId, String(inv.email));
    }
  }

  const rows: AdminClientRow[] = orgs.map((org) => {
    const account = Array.isArray(org.accounts)
      ? org.accounts[0]
      : org.accounts;
    const rawSource = account?.provision_source ?? "managed";
    const provisionSource: ClientProvisionSource = isClientProvisionSource(
      rawSource,
    )
      ? rawSource
      : "managed";

    return {
      orgId: org.id,
      accountId: org.account_id,
      name: org.name,
      slug: org.slug,
      niche: org.niche,
      createdAt: org.created_at,
      provisionSource,
      accountStatus: account?.status ?? "active",
      onboardingStep: org.onboarding_step,
      orgStatus: org.status,
      planTier: account?.plan_tier ?? null,
      platformSubscriptionId: account?.platform_subscription_id ?? null,
      ownerEmail: inviteEmailByOrg.get(org.id) ?? null,
      provisioningStage: stageByOrg.get(org.id) ?? null,
      phoneNumber: org.phone_number,
    };
  });

  if (filter === "all") return rows;
  return rows.filter((r) => r.provisionSource === filter);
}

export type AdminClientDetail = AdminClientRow & {
  storeCode: string | null;
  isActive: boolean;
  inviteSentAt: string | null;
  inviteAcceptedAt: string | null;
};

export async function loadAdminClientDetail(
  orgId: string,
): Promise<AdminClientDetail | null> {
  const admin = createAdminClient();

  const { data: org, error } = await admin
    .from("organizations")
    .select(
      `id, account_id, name, slug, niche, created_at, status, onboarding_step, phone_number, is_primary_location, store_code, is_active,
       accounts ( provision_source, status, plan_tier, platform_subscription_id, billing_interval )`,
    )
    .eq("id", orgId)
    .maybeSingle();

  if (error || !org) return null;

  const orgRow = org as OrgRow & {
    store_code: string | null;
    is_active: boolean | null;
  };
  const account = Array.isArray(orgRow.accounts)
    ? orgRow.accounts[0]
    : orgRow.accounts;
  const rawSource = account?.provision_source ?? "managed";
  const provisionSource: ClientProvisionSource = isClientProvisionSource(
    rawSource,
  )
    ? rawSource
    : "managed";

  const [{ data: invite }, stageByOrg] = await Promise.all([
    admin
      .from("admin_invites")
      .select("email, sent_at, accepted_at")
      .eq("organization_id", orgId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadProvisioningStagesByOrgId([orgId]),
  ]);

  return {
    orgId: orgRow.id,
    accountId: orgRow.account_id,
    name: orgRow.name,
    slug: orgRow.slug,
    niche: orgRow.niche,
    createdAt: orgRow.created_at,
    provisionSource,
    accountStatus: account?.status ?? "active",
    onboardingStep: orgRow.onboarding_step,
    orgStatus: orgRow.status,
    planTier: account?.plan_tier ?? null,
    platformSubscriptionId: account?.platform_subscription_id ?? null,
    ownerEmail: invite?.email ? String(invite.email) : null,
    provisioningStage: stageByOrg.get(orgId) ?? null,
    phoneNumber: orgRow.phone_number,
    storeCode: orgRow.store_code,
    isActive: orgRow.is_active === true,
    inviteSentAt: invite?.sent_at ? String(invite.sent_at) : null,
    inviteAcceptedAt: invite?.accepted_at ? String(invite.accepted_at) : null,
  };
}
