import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { PRODUCT_NAME } from "@/lib/company-details";
import {
  clientProvisionSourceBadgeClass,
  clientProvisionSourceLabel,
  parseClientProvisionFilter,
} from "@/lib/client-provision-source";
import { loadAdminClients } from "@/lib/load-admin-clients";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import { cn } from "@/lib/utils";

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

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "managed", label: "Managed" },
  { value: "self_serve", label: "Self-serve" },
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

  return (
    <AdminPageShell
      icon={Users}
      title="Customers"
      description="Managed custom jobs and self-serve SaaS accounts — provision, configure, and support from one place."
      actions={<NewClientDialog />}
    >
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(({ value, label }) => {
          const active = filter === value;
          const href =
            value === "all"
              ? "/admin/customers"
              : `/admin/customers?type=${value}`;
          return (
            <Link
              key={value}
              href={href}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : (
        <AdminSectionCard
          title="All customers"
          description={`${rows.length} customer${rows.length === 1 ? "" : "s"}${filter !== "all" ? ` (${clientProvisionSourceLabel(filter)})` : ""}.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-white">
                  <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                    Customer
                  </th>
                  <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                    Niche
                  </th>
                  <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                    Owner
                  </th>
                  <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
                    Created
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-gray-500"
                    >
                      No customers yet. Use{" "}
                      <strong>New client</strong> above to provision the first
                      managed account.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.orgId} className="hover:bg-gray-50/50">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/customers/${row.orgId}`}
                          className="block min-w-0"
                        >
                          <span className="text-sm font-medium text-gray-900 hover:underline">
                            {row.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-gray-400">
                            {row.slug}
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={clientProvisionSourceBadgeClass(
                            row.provisionSource,
                          )}
                        >
                          {clientProvisionSourceLabel(row.provisionSource)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {
                          ORGANIZATION_NICHE_ADMIN_LABELS[
                            parseOrganizationNiche(row.niche)
                          ]
                        }
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {row.provisionSource === "managed" &&
                        row.provisioningStage ? (
                          <TenantProvisioningStageChip
                            stage={row.provisioningStage}
                          />
                        ) : (
                          <span className="text-sm capitalize text-gray-600">
                            {row.orgStatus ?? row.accountStatus}
                            {row.onboardingStep != null &&
                            row.onboardingStep > 0
                              ? ` · step ${row.onboardingStep}`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[180px] truncate px-5 py-4 text-sm text-gray-600">
                        {row.ownerEmail ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500 tabular-nums">
                        {formatDateShort(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
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
          </div>
        </AdminSectionCard>
      )}
    </AdminPageShell>
  );
}
