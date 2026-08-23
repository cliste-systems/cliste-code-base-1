import { AdminSetupStatusBadge } from "@/components/admin/admin-setup-status-badge";
import {
  tenantProvisioningStageLabel,
  type TenantProvisioningStage,
} from "@/lib/tenant-provisioning-status";

export function TenantProvisioningStageChip({
  stage,
  className,
}: {
  stage: TenantProvisioningStage;
  className?: string;
}) {
  return (
    <AdminSetupStatusBadge isLive={stage === "live"} className={className}>
      {tenantProvisioningStageLabel(stage)}
    </AdminSetupStatusBadge>
  );
}

export function TenantProvisioningStepTicks({
  completeCount,
  totalCount,
}: {
  completeCount: number;
  totalCount: number;
}) {
  return (
    <span className="font-mono text-[11px] text-gray-500">
      {completeCount}/{totalCount}
    </span>
  );
}
