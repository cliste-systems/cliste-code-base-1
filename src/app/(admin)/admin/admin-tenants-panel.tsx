import Link from "next/link";

import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";

import { TenantRowActions } from "./tenant-row-actions";

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

type AdminTenantsPanelProps = {
  organizations: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    niche: string | null;
    created_at: string;
  }[];
};

export function AdminTenantsPanel({ organizations }: AdminTenantsPanelProps) {
  return (
    <aside
      className="flex max-h-[min(720px,calc(100vh-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm lg:max-h-none lg:min-h-0 lg:flex-1"
      aria-labelledby="tenants-heading"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 id="tenants-heading" className="text-sm font-semibold text-[#0b1220]">
          Tenants
        </h2>
        <span className="text-xs text-slate-500">{organizations.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {organizations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No tenants yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {organizations.map((org) => (
              <li
                key={org.id}
                className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
              >
                <Link
                  href={`/admin/organizations/${org.id}`}
                  className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                >
                  <p className="truncate text-[13px] font-medium text-[#0b1220] hover:underline">
                    {org.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {
                      ORGANIZATION_NICHE_ADMIN_LABELS[
                        parseOrganizationNiche(org.niche)
                      ]
                    }
                    {" · "}
                    {formatDateShort(org.created_at)}
                  </p>
                </Link>
                <TenantRowActions
                  organizationId={org.id}
                  organizationName={org.name}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
