import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import {
  ADMIN_LIST_PAGE_CLASS,
  AdminListCard,
} from "@/components/admin/admin-list-card";
import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { PRODUCT_NAME } from "@/lib/company-details";
import {
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";
import { createAdminClient } from "@/utils/supabase/admin";

import { CloseSupportButton } from "./close-support-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Support tickets`,
};

type OrgJoin = { name: string; slug: string };

type SupportTicketAdminRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  organization_id: string;
  organizations: OrgJoin | OrgJoin[] | null;
};

function orgLabel(row: SupportTicketAdminRow): string {
  const o = row.organizations;
  if (!o) return "—";
  const one = Array.isArray(o) ? o[0] : o;
  return one?.name?.trim() || "—";
}

function orgSlug(row: SupportTicketAdminRow): string | null {
  const o = row.organizations;
  if (!o) return null;
  const one = Array.isArray(o) ? o[0] : o;
  const s = one?.slug?.trim();
  return s || null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function messagePreview(body: string, maxLen = 120): string {
  const t = body.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trim()}…`;
}

export default async function AdminSupportPage() {
  let tickets: SupportTicketAdminRow[] = [];
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("support_tickets")
      .select(
        "id, subject, body, status, created_at, organization_id, organizations ( name, slug )",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    tickets = (data ?? []) as SupportTicketAdminRow[];
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load support tickets.";
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const countLabel = `${tickets.length} ticket${tickets.length === 1 ? "" : "s"}${
    openCount > 0 ? ` · ${openCount} open` : ""
  }`;

  return (
    <AdminPageShell
      icon={LifeBuoy}
      title="Support tickets"
      description={
        <>
          Requests submitted from each client&apos;s{" "}
          <Link
            href="/dashboard/support"
            className="font-medium text-gray-700 underline-offset-2 hover:underline"
          >
            Support
          </Link>{" "}
          page. Mark closed when you&apos;re done — clients still see their
          history.
        </>
      }
      className={ADMIN_LIST_PAGE_CLASS}
    >
      {loadError ? (
        <AdminErrorCard
          message={loadError}
          hint={
            loadError.includes("support_tickets") ||
            loadError.includes("schema cache") ? (
              <p>
                Apply migration{" "}
                <code className="font-mono text-xs">007_support_tickets.sql</code>{" "}
                if this table is new.
              </p>
            ) : null
          }
        />
      ) : (
        <AdminListCard countLabel={countLabel}>
          <table className={`${adminTableClass} min-w-[900px]`}>
            <thead className={adminTableHeadClass}>
              <tr>
                <th className={adminTableThClass}>Client</th>
                <th className={adminTableThClass}>Subject</th>
                <th className={adminTableThClass}>Message</th>
                <th className={adminTableThClass}>Status</th>
                <th className={adminTableThClass}>Submitted</th>
                <th className={`${adminTableThClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className={adminTableEmptyClass}>
                    No support tickets yet.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className={adminTableRowClass}>
                    <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {orgLabel(t)}
                        </span>
                        {orgSlug(t) ? (
                          <span className="mt-0.5 font-mono text-[11px] text-gray-400">
                            {orgSlug(t)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className={`max-w-[200px] truncate text-sm text-gray-600 ${adminTableTdClass}`}
                    >
                      {t.subject}
                    </td>
                    <td
                      className={`max-w-md truncate text-sm text-gray-600 ${adminTableTdClass}`}
                      title={t.body}
                    >
                      {messagePreview(t.body)}
                    </td>
                    <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                      <AdminBadge className="capitalize">{t.status}</AdminBadge>
                    </td>
                    <td
                      className={`whitespace-nowrap text-sm text-gray-500 tabular-nums ${adminTableTdClass}`}
                    >
                      {formatWhen(t.created_at)}
                    </td>
                    <td className={`whitespace-nowrap text-right ${adminTableTdClass}`}>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/admin/support/${t.id}`}
                          className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        >
                          View thread
                        </Link>
                        {t.status === "open" ? (
                          <CloseSupportButton ticketId={t.id} />
                        ) : null}
                      </div>
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
