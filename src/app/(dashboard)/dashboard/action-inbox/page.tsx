import { Inbox } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardInlineSummary } from "@/components/dashboard/dashboard-inline-summary";
import {
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import {
  formatCallDateTimeLabel,
  formatE164ForDisplay,
} from "@/lib/call-history-types";
import { resolveCallerDisplayName } from "@/lib/caller-identity";
import { requireDashboardSession } from "@/lib/dashboard-session";

import {
  ACTION_CATEGORY_LABELS,
  ACTION_CATEGORY_SHORT,
  classifyActionCategory,
} from "./categories";
import {
  buildActionInboxMetrics,
  formatActionDateTimeLabel,
  resolveContactEmail,
  type ActionInboxItem,
  type RelatedCallPreview,
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
  id: string;
  caller_number: string;
  caller_name: string | null;
  ai_summary: string | null;
  created_at: string;
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

function buildLatestCallByPhone(calls: CallRow[]): Map<string, RelatedCallPreview> {
  const map = new Map<string, RelatedCallPreview>();
  for (const call of calls) {
    const key = phoneKey(call.caller_number);
    if (!key || map.has(key)) continue;
    map.set(key, {
      id: call.id,
      summary: call.ai_summary?.trim() ?? null,
      dateLabel: formatCallDateTimeLabel(call.created_at),
      callerName: call.caller_name?.trim() || null,
    });
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
  callsByPhone: Map<string, RelatedCallPreview>,
  clientsByPhone: Map<string, ClientByPhone>,
): ActionInboxItem {
  const category = classifyActionCategory(row.summary);
  const callerNumber = row.caller_number?.trim() ?? "";
  const callerDisplay = formatE164ForDisplay(callerNumber) || "";
  const key = phoneKey(callerNumber);
  const client = key ? clientsByPhone.get(key) : undefined;
  const relatedCall = key ? (callsByPhone.get(key) ?? null) : null;

  const callerName = resolveCallerDisplayName(
    [row.caller_name, client?.name, relatedCall?.callerName],
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
    categoryTitle: ACTION_CATEGORY_LABELS[category],
    categoryShort: ACTION_CATEGORY_SHORT[category],
    relatedCall,
  };
}

export default async function ActionInboxPage({
  searchParams,
}: ActionInboxPageProps) {
  const sp = searchParams ? await searchParams : {};
  const initialSelectedTicketId =
    typeof sp.ticket === "string" && sp.ticket.trim() ? sp.ticket.trim() : null;

  const { supabase, organizationId } = await requireDashboardSession();

  const [{ data: ticketData, error }, { data: callData }, { data: clientData }] =
    await Promise.all([
      supabase
        .from("action_tickets")
        .select("id, caller_number, caller_name, summary, status, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("call_logs")
        .select("id, caller_number, caller_name, ai_summary, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("clients")
        .select("phone_e164, name, email")
        .eq("organization_id", organizationId)
        .limit(5000),
    ]);

  const callsByPhone = buildLatestCallByPhone((callData ?? []) as CallRow[]);
  const clientsByPhone = buildClientsByPhone((clientData ?? []) as ClientRow[]);
  const items = !error
    ? ((ticketData ?? []) as TicketRow[]).map((row) =>
        toInboxItem(row, callsByPhone, clientsByPhone),
      )
    : [];

  const metrics = buildActionInboxMetrics(items);

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <DashboardAnimatedPageSections>
      <header className="shrink-0">
        <div className="flex items-start gap-3">
          <span className={DASHBOARD_ICON_CHIP_LG}>
            <Inbox className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
          </span>
          <div className="min-w-0 space-y-2">
            <div>
              <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[26px]">
                Action inbox
              </h1>
              <p className="mt-0.5 max-w-xl text-[13px] leading-snug text-slate-600">
                Callbacks, urgent issues, and follow-ups Cara flagged for you — not
                your full call log.
              </p>
            </div>
            <DashboardInlineSummary
              segments={[
                { value: String(metrics.openCount), label: "open" },
                { value: String(metrics.urgentCount), label: "urgent" },
                { value: String(metrics.callbackCount), label: "callbacks" },
                { value: String(metrics.resolvedCount), label: "resolved" },
              ]}
            />
          </div>
        </div>
      </header>

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
        />
      )}
      </DashboardAnimatedPageSections>
    </div>
  );
}
