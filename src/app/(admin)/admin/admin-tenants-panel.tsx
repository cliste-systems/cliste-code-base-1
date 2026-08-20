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
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
      aria-labelledby="tenants-heading"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 id="tenants-heading" className="text-sm font-semibold text-[#0b1220]">
          Tenants
        </h2>
        <span className="text-xs text-slate-500">{organizations.length}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {organizations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">No tenants yet</p>
            <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-slate-500">
              New signups from{" "}
              <Link href="/signup" className="font-medium text-[#0b1220] underline-offset-2 hover:underline">
                /signup
              </Link>{" "}
              will appear here.
            </p>
          </div>
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
