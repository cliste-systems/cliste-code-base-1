import Link from "next/link";
import { Inbox } from "lucide-react";

import {
  AdminPageEmptyState,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { loadProvisioningPipeline } from "@/lib/load-provisioning-pipeline";
import {
  tenantProvisioningStageLabel,
  type TenantProvisioningStage,
} from "@/lib/tenant-provisioning-status";

import {
  TenantProvisioningStageChip,
  TenantProvisioningStepTicks,
} from "../tenant-provisioning-chip";
import { NewClientDialog } from "../new-client-dialog";

export const dynamic = "force-dynamic";

const STAGE_ORDER: TenantProvisioningStage[] = [
  "invited",
  "configuring",
  "ready",
  "live",
];

export default async function OnboardingPipelinePage() {
  const pipeline = await loadProvisioningPipeline();

  const byStage = Object.fromEntries(
    STAGE_ORDER.map((stage) => [stage, [] as typeof pipeline]),
  ) as Record<TenantProvisioningStage, typeof pipeline>;

  for (const row of pipeline) {
    byStage[row.provisioning.stage].push(row);
  }

  return (
    <AdminPageShell
      icon={Inbox}
      title="Onboarding"
      description="Admin-led retail store provisioning — from invite through go-live."
      actions={<NewClientDialog />}
    >
      {pipeline.length === 0 ? (
        <AdminPageEmptyState>
          <p>No admin-provisioned stores yet.</p>
          <p className="mt-2">
            Use <strong>New retail client</strong> above to provision the first
            store.
          </p>
        </AdminPageEmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {STAGE_ORDER.map((stage) => {
            const rows = byStage[stage];
            return (
              <section
                key={stage}
                className="flex min-h-[280px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {tenantProvisioningStageLabel(stage)}
                  </h2>
                  <span className="text-xs text-gray-500">{rows.length}</span>
                </header>
                <ul className="flex-1 divide-y divide-gray-50 overflow-y-auto">
                  {rows.length === 0 ? (
                    <li className="px-4 py-6 text-xs text-gray-400">None</li>
                  ) : (
                    rows.map(({ org, provisioning, inviteEmail }) => {
                      const completeCount = provisioning.steps.filter(
                        (s) => s.complete,
                      ).length;
                      return (
                        <li key={org.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link
                                href={`/admin/organizations/${org.id}`}
                                className="block truncate text-sm font-medium text-gray-900 hover:underline"
                              >
                                {org.name}
                              </Link>
                              {inviteEmail ? (
                                <p className="truncate text-[11px] text-gray-500">
                                  {inviteEmail}
                                </p>
                              ) : null}
                            </div>
                            <TenantProvisioningStageChip stage={stage} />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                            <TenantProvisioningStepTicks
                              completeCount={completeCount}
                              totalCount={provisioning.steps.length}
                            />
                            {provisioning.daysSinceInvite != null ? (
                              <span>{provisioning.daysSinceInvite}d</span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
}
