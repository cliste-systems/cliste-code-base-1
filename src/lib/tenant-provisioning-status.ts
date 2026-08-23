export type TenantProvisioningStepId =
  | "invite_sent"
  | "invite_accepted"
  | "legal_acceptance"
  | "phone_assigned"
  | "live";

export type TenantProvisioningStage =
  | "invited"
  | "configuring"
  | "ready"
  | "live";

export type TenantProvisioningStep = {
  id: TenantProvisioningStepId;
  label: string;
  complete: boolean;
  detail: string;
};

export type TenantProvisioningStatus = {
  stage: TenantProvisioningStage;
  steps: TenantProvisioningStep[];
  readyForGoLive: boolean;
  daysSinceInvite: number | null;
};

export type TenantProvisioningInput = {
  organizationId: string;
  organizationName: string;
  assistantDisplayName: string;
  greeting: string;
  customPrompt: string;
  phoneNumber: string;
  poolPhoneE164: string | null;
  poolPhoneAssigned: boolean;
  callRoutingMode: string | null;
  fallbackNumber: string;
  storePublicNumber: string;
  divertCarrier: string;
  businessHours: unknown;
  agentServicesDepartments: unknown;
  agentFaqs: unknown;
  ownerUserId: string | null;
  ownerHasLegalAcceptances: boolean;
  inviteSentAt: string | null;
  inviteAcceptedAt: string | null;
  hasInboundCallLog: boolean;
  caraOnlineSince: string | null;
};

export const TENANT_PROVISIONING_STEP_ORDER: {
  id: TenantProvisioningStepId;
  label: string;
}[] = [
  { id: "invite_sent", label: "Invite sent" },
  { id: "invite_accepted", label: "Invite accepted" },
  { id: "legal_acceptance", label: "Legal acceptance" },
  { id: "phone_assigned", label: "Phone assigned" },
  { id: "live", label: "Live" },
];

const GO_LIVE_STEP_IDS: TenantProvisioningStepId[] = ["phone_assigned"];

export function buildTenantProvisioningStatus(
  input: TenantProvisioningInput,
): TenantProvisioningStatus {
  const inviteSent = Boolean(input.inviteSentAt);
  const inviteAccepted = Boolean(input.inviteAcceptedAt);
  const legalAccepted =
    !input.ownerUserId || input.ownerHasLegalAcceptances;

  const orgPhone = input.phoneNumber.trim();
  const poolE164 = input.poolPhoneE164?.trim() ?? "";
  const phoneAssigned =
    Boolean(orgPhone) &&
    input.poolPhoneAssigned &&
    poolE164 === orgPhone;

  const live = Boolean(input.caraOnlineSince);

  const steps: TenantProvisioningStep[] = TENANT_PROVISIONING_STEP_ORDER.map(
    ({ id, label }) => {
      switch (id) {
        case "invite_sent":
          return {
            id,
            label,
            complete: inviteSent,
            detail: inviteSent
              ? "Owner invite emailed."
              : "Send the owner invite.",
          };
        case "invite_accepted":
          return {
            id,
            label,
            complete: inviteAccepted,
            detail: inviteAccepted
              ? "Owner signed in."
              : "Waiting for owner to accept invite.",
          };
        case "legal_acceptance":
          return {
            id,
            label,
            complete: legalAccepted,
            detail: legalAccepted
              ? "Required legal documents accepted."
              : "Owner must accept legal terms in dashboard.",
          };
        case "phone_assigned":
          return {
            id,
            label,
            complete: phoneAssigned,
            detail: phoneAssigned
              ? `Cliste number ${orgPhone} assigned.`
              : "Assign an Irish Cliste number.",
          };
        case "live":
          return {
            id,
            label,
            complete: live,
            detail: live ? "Store is live." : "Go live when ready.",
          };
        default:
          return { id, label, complete: false, detail: "" };
      }
    },
  );

  const readyForGoLive = GO_LIVE_STEP_IDS.every(
    (id) => steps.find((s) => s.id === id)?.complete,
  );

  let stage: TenantProvisioningStage;
  if (live) {
    stage = "live";
  } else if (readyForGoLive) {
    stage = "ready";
  } else if (inviteAccepted) {
    stage = "configuring";
  } else {
    stage = "invited";
  }

  let daysSinceInvite: number | null = null;
  if (input.inviteSentAt) {
    const sent = new Date(input.inviteSentAt);
    if (!Number.isNaN(sent.getTime())) {
      daysSinceInvite = Math.floor(
        (Date.now() - sent.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
  }

  return { stage, steps, readyForGoLive, daysSinceInvite };
}

export function tenantProvisioningStageLabel(
  stage: TenantProvisioningStage,
): string {
  switch (stage) {
    case "invited":
      return "Invited";
    case "configuring":
      return "Configuring";
    case "ready":
      return "Ready";
    case "live":
      return "Live";
  }
}
