import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";

import { cn } from "@/lib/utils";
import { createAdminClient } from "@/utils/supabase/admin";

import { CloseSupportButton } from "./close-support-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cliste Admin — Support tickets",
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

  return (
    <div className="mx-auto max-w-[1100px] p-6 pb-24 sm:p-10 lg:p-12">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <LifeBuoy
            className="size-4 shrink-0 text-gray-400"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="text-xs font-medium tracking-widest text-gray-500 uppercase">
            Platform
          </p>
        </div>
        <h1 className="mb-4 text-3xl font-medium tracking-tight text-gray-900">
          Salon support tickets
        </h1>
        <p className="max-w-3xl text-base leading-relaxed font-normal text-gray-500">
          Requests submitted from each salon&apos;s{" "}
          <Link
            href="/dashboard/support"
            className="font-medium text-gray-700 underline-offset-2 hover:underline"
          >
            Support
          </Link>{" "}
          page. Mark closed when you&apos;re done — salons still see their
          history.
        </p>
      </header>

      {loadError ? (
        <div className="mb-8 rounded-xl border border-red-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-red-700">{loadError}</p>
          {loadError.includes("support_tickets") ||
          loadError.includes("schema cache") ? (
            <p className="mt-2 text-sm text-red-600/90">
              Apply migration <code className="font-mono text-xs">007_support_tickets.sql</code>{" "}
              if this table is new.
            </p>
          ) : null}
        </div>
      ) : null}

      <section aria-label="Support tickets">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-base font-medium text-gray-900">All tickets</h2>
            <p className="mt-1 text-sm font-normal text-gray-500">
              Newest first. Open tickets are highlighted.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-white">
                  <th className="w-[15%] px-6 py-4 text-sm font-medium text-gray-900">
                    Salon
                  </th>
                  <th className="w-[20%] px-6 py-4 text-sm font-medium text-gray-900">
                    Subject
                  </th>
                  <th className="w-[25%] px-6 py-4 text-sm font-medium text-gray-900">
                    Message
                  </th>
                  <th className="w-[10%] px-6 py-4 text-sm font-medium text-gray-900">
                    Status
                  </th>
                  <th className="w-[20%] px-6 py-4 text-sm font-medium text-gray-900">
                    Submitted
                  </th>
                  <th className="w-[10%] px-6 py-4 text-right text-sm font-medium text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-500"
                    >
                      No support tickets yet.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => {
                    const isOpen = t.status === "open";
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          "transition-colors hover:bg-gray-50/50",
                          isOpen && "bg-emerald-50/35",
                        )}
                      >
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {orgLabel(t)}
                            </span>
                            {orgSlug(t) ? (
                              <span className="mt-0.5 font-mono text-xs text-gray-400">
                                {orgSlug(t)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[200px] truncate px-6 py-4 text-sm font-normal whitespace-nowrap text-gray-600">
                          {t.subject}
                        </td>
                        <td
                          className="max-w-md truncate px-6 py-4 text-sm font-normal text-gray-600"
                          title={t.body}
                        >
                          {messagePreview(t.body)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
                              isOpen
                                ? "border-emerald-200/80 bg-emerald-50 text-emerald-800"
                                : "border-gray-200/80 bg-gray-50 text-gray-600",
                            )}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-normal text-gray-500 tabular-nums">
                          {formatWhen(t.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Link
                              href={`/admin/support/${t.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
                            >
                              View thread
                            </Link>
                            {isOpen ? (
                              <CloseSupportButton ticketId={t.id} />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
