import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
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

  const countLabel = `${rows.length} customer${rows.length === 1 ? "" : "s"}${
    filter !== "all" ? ` · ${clientProvisionSourceLabel(filter)}` : ""
  }`;

  return (
    <AdminPageShell
      icon={Users}
      title="Customers"
      description="Managed custom jobs and self-serve SaaS accounts — provision, configure, and support from one place."
      className="flex min-h-full flex-col space-y-6 pb-16"
    >
      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : (
        <AdminSectionCard
          className="flex min-h-[calc(100vh-14rem)] flex-col"
          contentClassName="flex min-h-0 flex-1 flex-col p-0"
        >
          <header className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">{countLabel}</p>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
                role="tablist"
                aria-label="Customer type"
              >
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
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900",
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
              <NewClientDialog />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Niche
                  </th>
                  <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Owner
                  </th>
                  <th className="px-4 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-16 text-center text-sm text-gray-500"
                    >
                      No customers yet. Use <strong>New client</strong> to
                      provision the first managed account.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.orgId} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/customers/${row.orgId}`}
                          className="block min-w-0"
                          title={row.name}
                        >
                          <span className="text-sm font-medium text-gray-900 hover:underline">
                            {displayCustomerName(row.name)}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-gray-400">
                            {row.slug}
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <AdminBadge>
                          {clientProvisionSourceLabel(row.provisionSource)}
                        </AdminBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {
                          ORGANIZATION_NICHE_ADMIN_LABELS[
                            parseOrganizationNiche(row.niche)
                          ]
                        }
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
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
                      <td className="max-w-[180px] truncate px-4 py-3 text-sm text-gray-600">
                        {row.ownerEmail ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 tabular-nums">
                        {formatDateShort(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
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
