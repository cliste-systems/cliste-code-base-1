import { notFound } from "next/navigation";
import { Store } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import {
  ACTION_INBOX_CALL_LIMIT,
  ACTION_INBOX_CLIENT_LIMIT,
  ACTION_INBOX_TICKET_LIMIT,
} from "@/lib/dashboard-list-limits";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { isRetailDepartmentSlug } from "@/lib/retail-department-pack";

import type { ActionCategory } from "../../action-inbox/categories";
import {
  buildDepartmentInboxMetrics,
  departmentPageTitle,
  departmentTicketMatchesWorkspace,
  sortDepartmentInboxItems,
  toDepartmentInboxItem,
  type DepartmentTicketRow,
} from "../department-helpers";
import { DepartmentInboxView } from "./department-inbox-view";

type DepartmentPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ ticket?: string }>;
};

type CallRow = {
  caller_number: string;
  caller_name: string | null;
};

type ClientRow = {
  phone_e164: string;
  name: string;
  email: string | null;
};

function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

function buildLatestCallerNameByPhone(calls: CallRow[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const call of calls) {
    const key = phoneKey(call.caller_number);
    if (!key || map.has(key)) continue;
    map.set(key, call.caller_name?.trim() || null);
  }
  return map;
}

function buildClientsByPhone(
  clients: ClientRow[],
): Map<string, { name: string; email: string | null }> {
  const map = new Map<string, { name: string; email: string | null }>();
  for (const client of clients) {
    const key = phoneKey(client.phone_e164);
    if (!key || map.has(key)) continue;
    map.set(key, {
      name: client.name.trim(),
      email: client.email?.trim() || null,
    });
  }
  return map;
}

export default async function DepartmentWorkspacePage({
  params,
  searchParams,
}: DepartmentPageProps) {
  const { slug } = await params;
  if (!isRetailDepartmentSlug(slug) || slug === "general") {
    notFound();
  }

  const sp = searchParams ? await searchParams : {};
  const initialSelectedTicketId =
    typeof sp.ticket === "string" && sp.ticket.trim() ? sp.ticket.trim() : null;

  const { supabase, organizationId } = await requireDashboardSession();

  const [
    { data: ticketData, error },
    { data: callData },
    { data: clientData },
    { data: blockedRows },
    orgRow,
  ] = await Promise.all([
    supabase
      .from("action_tickets")
      .select(
        "id, call_log_id, caller_number, caller_name, summary, brief_summary, department_slug, status, created_at, delivery_status",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(ACTION_INBOX_TICKET_LIMIT),
    supabase
      .from("call_logs")
      .select("caller_number, caller_name")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(ACTION_INBOX_CALL_LIMIT),
    supabase
      .from("clients")
      .select("phone_e164, name, email")
      .eq("organization_id", organizationId)
      .limit(ACTION_INBOX_CLIENT_LIMIT),
    supabase
      .from("blocked_callers")
      .select("caller_e164")
      .eq("organization_id", organizationId),
    getCachedDashboardOrganizationRow(),
  ]);

  const categoryLabels = dashboardVerticalCopy(
    orgRow?.niche,
    orgRow?.agent_business_type,
  ).actionInbox.categoryLabels as Record<ActionCategory, string>;

  const callerNameByPhone = buildLatestCallerNameByPhone((callData ?? []) as CallRow[]);
  const clientsByPhone = buildClientsByPhone((clientData ?? []) as ClientRow[]);

  const allItems = !error
    ? ((ticketData ?? []) as DepartmentTicketRow[]).map((row) =>
        toDepartmentInboxItem(row, callerNameByPhone, clientsByPhone, categoryLabels),
      )
    : [];

  const items = sortDepartmentInboxItems(
    allItems.filter((item) => departmentTicketMatchesWorkspace(item.departmentSlug, slug)),
  );
  const metrics = buildDepartmentInboxMetrics(items);
  const blockedCallerE164s = (blockedRows ?? []).map(
    (row) => String((row as { caller_e164: string }).caller_e164),
  );

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections>
          <ClistePageHeader
            tone="inbox"
            icon={Store}
            title={departmentPageTitle(slug)}
            description="Who to call back and what they need — tap a request, review the call, then text back or mark done."
            summary={[
              { value: String(metrics.openCount), label: "to do" },
              { value: String(metrics.callbackCount), label: "callbacks" },
            ]}
          />

          {error ? (
            <p className="shrink-0 text-[13px] text-red-700">
              Could not load department inbox: {error.message}
            </p>
          ) : (
            <DepartmentInboxView
              className="min-h-0 flex-1"
              items={items}
              metrics={metrics}
              initialSelectedTicketId={initialSelectedTicketId}
              blockedCallerE164s={blockedCallerE164s}
            />
          )}
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
