import type { ClientProvisionSource } from "@/lib/client-provision-source";
import type { TenantProvisioningStage } from "@/lib/tenant-provisioning-status";

export function isAdminClientLive(row: {
  provisionSource: ClientProvisionSource;
  provisioningStage: TenantProvisioningStage | null;
  orgStatus: string | null;
  accountStatus: string;
  onboardingStep: number | null;
}): boolean {
  if (row.provisionSource === "managed") {
    return row.provisioningStage === "live";
  }

  const status = (row.orgStatus ?? row.accountStatus).toLowerCase();
  if (status !== "active") return false;
  return row.onboardingStep == null || row.onboardingStep <= 0;
}

export function adminSetupStatusBadgeClass(isLive: boolean): string {
  return isLive
    ? "border-green-200 bg-green-50 text-green-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
}
