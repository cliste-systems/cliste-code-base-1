import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import {
  AdminListCard,
} from "@/components/admin/admin-list-card";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminSegmentedTabs } from "@/components/admin/admin-segmented-tabs";
import {
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableTdTruncateClass,
  adminTableThActionsClass,
  adminTableThClass,
  adminTableThWidth,
} from "@/components/admin/admin-table";
import { PRODUCT_NAME } from "@/lib/company-details";
import {
  clientProvisionSourceLabel,
  parseClientProvisionFilter,
} from "@/lib/client-provision-source";
import { loadAdminClients } from "@/lib/load-admin-clients";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";

import { NewClientDialog } from "../new-client-dialog";
import { TenantProvisioningStageChip } from "../tenant-provisioning-chip";
import { TenantRowActions } from "../tenant-row-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Customers`,
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayCustomerName(name: string): string {
  return name.replace(/^\[smoke test\]\s*/i, "");
}

function formatStatusLabel(
  orgStatus: string | null,
  accountStatus: string,
  onboardingStep: number | null,
): string {
  const base = (orgStatus ?? accountStatus).replace(/_/g, " ");
  if (onboardingStep != null && onboardingStep > 0) {
    return `${base} · step ${onboardingStep}`;
  }
  return base;
}

const FILTER_TABS = [
  { value: "all", label: "All", href: "/admin/customers" },
  { value: "managed", label: "Managed", href: "/admin/customers?type=managed" },
  {
    value: "self_serve",
    label: "Self-serve",
    href: "/admin/customers?type=self_serve",
  },
] as const;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const filter = parseClientProvisionFilter(typeParam);

  let rows: Awaited<ReturnType<typeof loadAdminClients>> = [];
  let loadError: string | null = null;

  try {
    rows = await loadAdminClients(filter);
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load customers.";
  }

  const countLabel = `${rows.length} customer${rows.length === 1 ? "" : "s"}${
    filter !== "all" ? ` · ${clientProvisionSourceLabel(filter)}` : ""
  }`;

  return (
    <AdminPageShell
      icon={Users}
      title="Customers"
      description="Managed custom jobs and self-serve SaaS accounts — provision, configure, and support from one place."
      fillViewport
    >
      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : (
        <AdminListCard
          countLabel={countLabel}
          toolbar={
            <>
              <AdminSegmentedTabs
                tabs={[...FILTER_TABS]}
                activeValue={filter}
                ariaLabel="Customer type"
              />
              <NewClientDialog />
            </>
          }
        >
          <table className={adminTableClass}>
            <thead className={adminTableHeadClass}>
              <tr>
                <th className={adminTableThWidth("w-[24%]")}>Customer</th>
                <th className={adminTableThWidth("w-[10%]")}>Type</th>
                <th className={adminTableThWidth("w-[12%]")}>Niche</th>
                <th className={adminTableThWidth("w-[14%]")}>Status</th>
                <th className={adminTableThWidth("w-[18%]")}>Owner</th>
                <th className={adminTableThWidth("w-[13%]")}>Created</th>
                <th className={adminTableThActionsClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={adminTableEmptyClass}>
                    No customers yet. Use <strong>New client</strong> to
                    provision the first managed account.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.orgId} className={adminTableRowClass}>
                    <td className={adminTableTdTruncateClass}>
                      <Link
                        href={`/admin/customers/${row.orgId}`}
                        className="block min-w-0"
                        title={row.name}
                      >
                        <span className="block truncate text-sm font-medium text-gray-900 hover:underline">
                          {displayCustomerName(row.name)}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-gray-400">
                          {row.slug}
                        </span>
                      </Link>
                    </td>
                    <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                      <AdminBadge>
                        {clientProvisionSourceLabel(row.provisionSource)}
                      </AdminBadge>
                    </td>
                    <td
                      className={`whitespace-nowrap text-sm text-gray-600 ${adminTableTdClass}`}
                    >
                      {
                        ORGANIZATION_NICHE_ADMIN_LABELS[
                          parseOrganizationNiche(row.niche)
                        ]
                      }
                    </td>
                    <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                      {row.provisionSource === "managed" &&
                      row.provisioningStage ? (
                        <TenantProvisioningStageChip
                          stage={row.provisioningStage}
                        />
                      ) : (
                        <AdminBadge className="capitalize">
                          {formatStatusLabel(
                            row.orgStatus,
                            row.accountStatus,
                            row.onboardingStep,
                          )}
                        </AdminBadge>
                      )}
                    </td>
                    <td
                      className={`truncate text-sm text-gray-600 ${adminTableTdClass}`}
                      title={row.ownerEmail ?? undefined}
                    >
                      {row.ownerEmail ?? ""}
                    </td>
                    <td
                      className={`whitespace-nowrap text-sm text-gray-500 tabular-nums ${adminTableTdClass}`}
                    >
                      {formatDateShort(row.createdAt)}
                    </td>
                    <td className={`whitespace-nowrap text-right ${adminTableTdClass}`}>
                      <TenantRowActions
                        organizationId={row.orgId}
                        organizationName={row.name}
                        customerHref={`/admin/customers/${row.orgId}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminListCard>
      )}
    </AdminPageShell>
  );
}
