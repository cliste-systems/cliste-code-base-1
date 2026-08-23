import type { PlanTier } from "@/lib/cliste-plans.data";
import {
  buildTenantProvisioningStatus,
  type TenantProvisioningInput,
  type TenantProvisioningStatus,
} from "@/lib/tenant-provisioning-status";

export type TenantProvisioningOrgRow = {
  id: string;
  name: string;
  greeting?: string | null;
  custom_prompt?: string | null;
  assistant_display_name?: string | null;
  phone_number?: string | null;
  call_routing_mode?: string | null;
  fallback_number?: string | null;
  store_public_number?: string | null;
  divert_carrier?: string | null;
  business_hours?: unknown;
  agent_services_departments?: unknown;
  agent_faqs?: unknown;
  cara_online_since?: string | null;
};

export type TenantProvisioningPhoneRow = {
  e164: string;
  status: string;
} | null;

export type TenantProvisioningInviteRow = {
  sent_at: string;
  accepted_at: string | null;
  email: string;
} | null;

export type TenantProvisioningOwnerRow = {
  user_id: string;
  hasLegalAcceptances: boolean;
} | null;

export function buildTenantProvisioningInput(params: {
  org: TenantProvisioningOrgRow;
  poolPhone: TenantProvisioningPhoneRow;
  invite: TenantProvisioningInviteRow;
  owner: TenantProvisioningOwnerRow;
  hasInboundCallLog: boolean;
}): TenantProvisioningInput {
  const orgPhone = String(params.org.phone_number ?? "").trim();
  const poolE164 = params.poolPhone?.e164?.trim() ?? null;
  const poolAssigned = params.poolPhone?.status === "assigned";

  return {
    organizationId: params.org.id,
    organizationName: params.org.name,
    assistantDisplayName: String(
      params.org.assistant_display_name ?? "Cara",
    ),
    greeting: String(params.org.greeting ?? ""),
    customPrompt: String(params.org.custom_prompt ?? ""),
    phoneNumber: orgPhone,
    poolPhoneE164: poolE164,
    poolPhoneAssigned: poolAssigned,
    callRoutingMode: params.org.call_routing_mode ?? null,
    fallbackNumber: String(params.org.fallback_number ?? ""),
    storePublicNumber: String(params.org.store_public_number ?? ""),
    divertCarrier: String(params.org.divert_carrier ?? ""),
    businessHours: params.org.business_hours ?? null,
    agentServicesDepartments: params.org.agent_services_departments ?? [],
    agentFaqs: params.org.agent_faqs ?? [],
    ownerUserId: params.owner?.user_id ?? null,
    ownerHasLegalAcceptances: params.owner?.hasLegalAcceptances ?? false,
    inviteSentAt: params.invite?.sent_at ?? null,
    inviteAcceptedAt: params.invite?.accepted_at ?? null,
    hasInboundCallLog: params.hasInboundCallLog,
    caraOnlineSince: params.org.cara_online_since ?? null,
  };
}

export function deriveTenantProvisioningStatus(params: {
  org: TenantProvisioningOrgRow;
  poolPhone: TenantProvisioningPhoneRow;
  invite: TenantProvisioningInviteRow;
  owner: TenantProvisioningOwnerRow;
  hasInboundCallLog: boolean;
}): TenantProvisioningStatus {
  return buildTenantProvisioningStatus(buildTenantProvisioningInput(params));
}

export type { PlanTier };
