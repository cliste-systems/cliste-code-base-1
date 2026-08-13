import Link from "next/link";
import { GraduationCap, Inbox } from "lucide-react";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import {
  formatE164ForDisplay,
} from "@/lib/call-history-types";
import { resolveCallerDisplayName } from "@/lib/caller-identity";
import {
  ACTION_INBOX_CALL_LIMIT,
  ACTION_INBOX_CLIENT_LIMIT,
  ACTION_INBOX_TICKET_LIMIT,
} from "@/lib/dashboard-list-limits";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";

import {
  ACTION_CATEGORY_SHORT,
  classifyActionCategory,
  type ActionCategory,
} from "./categories";
import {
  buildActionInboxMetrics,
  formatActionDateTimeLabel,
  resolveContactEmail,
  sortActionInboxItems,
  type ActionInboxItem,
} from "./action-inbox-helpers";
import { ActionInboxView } from "./action-inbox-view";

type ActionInboxPageProps = {
  searchParams?: Promise<{ ticket?: string }>;
};

type TicketRow = {
  id: string;
  caller_number: string;
  caller_name: string | null;
  summary: string;
  status: string;
  created_at: string;
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

type ClientByPhone = {
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

function buildClientsByPhone(clients: ClientRow[]): Map<string, ClientByPhone> {
  const map = new Map<string, ClientByPhone>();
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

function toInboxItem(
  row: TicketRow,
  callerNameByPhone: Map<string, string | null>,
  clientsByPhone: Map<string, ClientByPhone>,
  categoryLabels: Record<ActionCategory, string>,
): ActionInboxItem {
  const category = classifyActionCategory(row.summary);
  const callerNumber = row.caller_number?.trim() ?? "";
  const callerDisplay = formatE164ForDisplay(callerNumber) || "";
  const key = phoneKey(callerNumber);
  const client = key ? clientsByPhone.get(key) : undefined;
  const callLogName = key ? (callerNameByPhone.get(key) ?? null) : null;

  const callerName = resolveCallerDisplayName(
    [row.caller_name, client?.name, callLogName],
    callerDisplay,
  );

  const contactEmail = resolveContactEmail(client?.email, row.summary);

  return {
    id: row.id,
    callerNumber,
    callerDisplay,
    callerName,
    contactLabel: callerName,
    contactEmail,
    summary: row.summary ?? "",
    status: row.status === "resolved" ? "resolved" : "open",
    createdAt: row.created_at,
    createdAtLabel: formatActionDateTimeLabel(row.created_at),
    category,
    categoryTitle: categoryLabels[category],
    categoryShort: ACTION_CATEGORY_SHORT[category],
  };
}

export default async function ActionInboxPage({
  searchParams,
}: ActionInboxPageProps) {
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
    { count: trainingGapCountRaw },
  ] =
    await Promise.all([
      supabase
        .from("action_tickets")
        .select("id, caller_number, caller_name, summary, status, created_at")
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
      supabase
        .from("cara_training_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["awaiting_answer", "draft_ready"]),
    ]);

  const trainingGapCount = trainingGapCountRaw ?? 0;

  const categoryLabels = dashboardVerticalCopy(
    orgRow?.niche,
    orgRow?.agent_business_type,
  ).actionInbox.categoryLabels;
  const callerNameByPhone = buildLatestCallerNameByPhone((callData ?? []) as CallRow[]);
  const clientsByPhone = buildClientsByPhone((clientData ?? []) as ClientRow[]);
  const items = !error
    ? sortActionInboxItems(
        ((ticketData ?? []) as TicketRow[]).map((row) =>
          toInboxItem(row, callerNameByPhone, clientsByPhone, categoryLabels),
        ),
      )
    : [];

  const metrics = buildActionInboxMetrics(items);
  const blockedCallerE164s = (blockedRows ?? []).map(
    (row) => String((row as { caller_e164: string }).caller_e164),
  );

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
      <DashboardAnimatedPageSections>
      <ClistePageHeader
        tone="inbox"
        icon={Inbox}
        title="Action inbox"
        description="Callbacks, urgent issues, and follow-ups Cara flagged for you, separate from the full call log."
        summary={[
          { value: String(metrics.openCount), label: "open" },
          { value: String(metrics.urgentCount), label: "urgent" },
          { value: String(metrics.callbackCount), label: "callbacks" },
          { value: String(metrics.resolvedCount), label: "resolved" },
        ]}
      />

      {trainingGapCount > 0 ? (
        <Link
          href={DASHBOARD_ROUTES.caraTraining}
          className="flex shrink-0 items-center gap-3 rounded-lg border border-[#cfd9d4] bg-[#fbfcfb] px-4 py-3 text-[#353D42] transition hover:bg-white"
        >
          <GraduationCap className="h-5 w-5 shrink-0 text-[#353D42]" aria-hidden />
          <span className="min-w-0 flex-1 text-[13px] leading-snug">
            <strong className="font-semibold">
              {trainingGapCount} {trainingGapCount === 1 ? "thing" : "things"} to teach Cara
            </strong>
            {" — "}gaps from calls Cara couldn&apos;t answer. Review and confirm so she handles
            them next time.
          </span>
          <span className="shrink-0 text-[13px] font-medium">Teach Cara →</span>
        </Link>
      ) : null}

      {error ? (
        <p className="shrink-0 text-[13px] text-red-700">
          Could not load Action Inbox: {error.message}
        </p>
      ) : (
        <ActionInboxView
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
