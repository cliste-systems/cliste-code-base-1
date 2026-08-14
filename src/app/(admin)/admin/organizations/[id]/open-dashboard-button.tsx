"use client";

import { SupportDashboardOpenDialog } from "@/components/admin/support-dashboard-open-dialog";

type OpenDashboardButtonProps = {
  organizationId: string;
};

/** Signs support in as a member so config can be checked end-to-end. */
export function OpenDashboardButton({
  organizationId,
}: OpenDashboardButtonProps) {
  return (
    <SupportDashboardOpenDialog
      organizationId={organizationId}
      triggerLabel="Open dashboard as tenant"
    />
  );
}
