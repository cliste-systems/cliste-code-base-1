import { cn } from "@/lib/utils";
import {
  tenantProvisioningStageLabel,
  type TenantProvisioningStage,
} from "@/lib/tenant-provisioning-status";

const STAGE_STYLES: Record<TenantProvisioningStage, string> = {
  invited: "bg-amber-50 text-amber-800 ring-amber-200/80",
  configuring: "bg-sky-50 text-sky-800 ring-sky-200/80",
  ready: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  live: "bg-violet-50 text-violet-800 ring-violet-200/80",
};

export function TenantProvisioningStageChip({
  stage,
  className,
}: {
  stage: TenantProvisioningStage;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        STAGE_STYLES[stage],
        className,
      )}
    >
      {tenantProvisioningStageLabel(stage)}
    </span>
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
    <span className="font-mono text-[11px] text-slate-500">
      {completeCount}/{totalCount}
    </span>
  );
}
