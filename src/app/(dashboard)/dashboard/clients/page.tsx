import { Users } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { normalizeContactEmail } from "../action-inbox/action-inbox-helpers";
import { mergeCallerName, resolveCallerDisplayName } from "@/lib/caller-identity";
import { formatPhoneForDisplay } from "@/lib/phone-display";
import {
  CONTACTS_CALL_LIMIT,
  CONTACTS_CLIENT_LIMIT,
  CONTACTS_TICKET_LIMIT,
} from "@/lib/dashboard-list-limits";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";

import type { ActionCategory } from "../action-inbox/categories";

import {
  buildFollowUp,
  buildContactsMetrics,
  durationLabelFor,
  formatContactDateLabel,
  formatContactDateTimeLabel,
  outcomeLabelFor,
  summaryPreview,
  type ContactCallEntry,
  type ContactListItem,
} from "./contacts-helpers";
import { ContactsView } from "./contacts-view";

type CallRow = {
  id: string;
  caller_number: string | null;
  caller_name?: string | null;
  created_at: string;
  outcome: string | null;
  ai_summary: string | null;
  duration_seconds: number | null;
};

type TicketRow = {
  id: string;
  caller_number: string | null;
  caller_name?: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
};

type ClientRow = {
  id: string;
  phone_e164: string;
  name: string;
  email: string | null;
  notes: string | null;
  created_at: string;
};

function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

function buildTicketsByKey(tickets: TicketRow[]): Map<string, TicketRow[]> {
  const map = new Map<string, TicketRow[]>();
  for (const t of tickets) {
    const key = phoneKey(t.caller_number);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return map;
}

function buildClientsByKey(clients: ClientRow[]): Map<string, ClientRow> {
  const map = new Map<string, ClientRow>();
  for (const client of clients) {
    const key = phoneKey(client.phone_e164);
    if (!key || map.has(key)) continue;
    map.set(key, client);
  }
  return map;
}

function applyClientRecord(contact: ContactListItem, client: ClientRow | undefined) {
  if (!client) return;
  contact.clientId = client.id;
  contact.displayName = resolveCallerDisplayName(
    [contact.displayName, client.name],
    contact.phoneDisplay,
  );
  contact.contactEmail = normalizeContactEmail(client.email);
  contact.clientNotes = client.notes?.trim() || null;
}

function toCallEntry(call: CallRow): ContactCallEntry {
  return {
    id: call.id,
    createdAt: call.created_at,
    dateLabel: formatContactDateLabel(call.created_at),
    dateTimeLabel: formatContactDateTimeLabel(call.created_at),
    durationLabel: durationLabelFor(call.duration_seconds),
    outcomeLabel: outcomeLabelFor(call.outcome),
    summary: call.ai_summary?.trim() || null,
  };
}

function buildContactsFromCalls(
  calls: CallRow[],
  ticketsByKey: Map<string, TicketRow[]>,
  clientsByKey: Map<string, ClientRow>,
  categoryLabels: Record<ActionCategory, string>,
): ContactListItem[] {
  const byKey = new Map<string, ContactListItem>();

  for (const call of calls) {
    const key = phoneKey(call.caller_number);
    if (!key) continue;

    const ts = new Date(call.created_at).getTime();
    const entry = toCallEntry(call);
    const existing = byKey.get(key);

    if (existing) {
      existing.callCount += 1;
      existing.calls.push(entry);
      existing.displayName = mergeCallerName(
        existing.displayName,
        call.caller_name,
      );
      existing.firstCallMs = Math.min(
        existing.firstCallMs,
        Number.isFinite(ts) ? ts : existing.firstCallMs,
      );
      if (Number.isFinite(ts) && ts > existing.lastCallMs) {
        existing.lastCallMs = ts;
        existing.lastCallLabel = entry.dateLabel;
        existing.lastSummaryPreview = summaryPreview(entry.summary);
        existing.lastOutcomeLabel = entry.outcomeLabel;
        existing.phoneRaw = call.caller_number?.trim() || existing.phoneRaw;
        existing.phoneDisplay = formatPhoneForDisplay(existing.phoneRaw);
      }
    } else {
      const related = ticketsByKey.get(key) ?? [];
      const openTickets = related.filter((t) => t.status !== "resolved");
      const phoneRaw = call.caller_number?.trim() || "";
      const phoneDisplay = formatPhoneForDisplay(phoneRaw);
      const ticketNames = related.map((t) => t.caller_name);
      const client = clientsByKey.get(key);
      byKey.set(key, {
        id: key,
        clientId: client?.id ?? null,
        phoneRaw,
        phoneDisplay,
        displayName: resolveCallerDisplayName(
          [call.caller_name, client?.name, ...ticketNames],
          phoneDisplay,
        ),
        contactEmail: normalizeContactEmail(client?.email),
        clientNotes: client?.notes?.trim() || null,
        callCount: 1,
        firstCallMs: Number.isFinite(ts) ? ts : 0,
        lastCallMs: Number.isFinite(ts) ? ts : 0,
        lastCallLabel: entry.dateLabel,
        lastSummaryPreview: summaryPreview(entry.summary),
        lastOutcomeLabel: entry.outcomeLabel,
        openFollowUps: openTickets.length,
        calls: [entry],
        openActions: openTickets.map((row) => buildFollowUp(row, categoryLabels)),
      });
    }
  }

  for (const [key, client] of clientsByKey) {
    if (byKey.has(key)) continue;

    const related = ticketsByKey.get(key) ?? [];
    const openTickets = related.filter((t) => t.status !== "resolved");
    const phoneDisplay = formatPhoneForDisplay(client.phone_e164);
    const createdMs = new Date(client.created_at).getTime();

    byKey.set(key, {
      id: key,
      clientId: client.id,
      phoneRaw: client.phone_e164,
      phoneDisplay,
      displayName: resolveCallerDisplayName([client.name], phoneDisplay),
      contactEmail: normalizeContactEmail(client.email),
      clientNotes: client.notes?.trim() || null,
      callCount: 0,
      firstCallMs: 0,
      lastCallMs: Number.isFinite(createdMs) ? createdMs : 0,
      lastCallLabel: formatContactDateLabel(client.created_at),
      lastSummaryPreview: null,
      lastOutcomeLabel: null,
      openFollowUps: openTickets.length,
      calls: [],
      openActions: openTickets.map((row) => buildFollowUp(row, categoryLabels)),
    });
  }

  for (const contact of byKey.values()) {
    applyClientRecord(contact, clientsByKey.get(contact.id));
    const tickets = ticketsByKey.get(contact.id) ?? [];
    const openTickets = tickets.filter((t) => t.status !== "resolved");
    contact.openFollowUps = openTickets.length;
    contact.openActions = openTickets.map((row) => buildFollowUp(row, categoryLabels));
    for (const t of tickets) {
      contact.displayName = mergeCallerName(contact.displayName, t.caller_name);
    }
    contact.displayName = resolveCallerDisplayName(
      [contact.displayName],
      contact.phoneDisplay,
    );
    contact.calls.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const latest = contact.calls[0];
    if (latest) {
      contact.lastSummaryPreview = summaryPreview(latest.summary);
      contact.lastOutcomeLabel = latest.outcomeLabel;
    }
  }

  return [...byKey.values()].sort((a, b) => b.lastCallMs - a.lastCallMs);
}

export default async function ContactsPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const [orgRow, { data: callData, error: callError }, { data: ticketData }, { data: clientData }] =
    await Promise.all([
      getCachedDashboardOrganizationRow(),
      supabase
        .from("call_logs")
        .select(
          "id, caller_number, caller_name, created_at, outcome, ai_summary, duration_seconds",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(CONTACTS_CALL_LIMIT),
      supabase
        .from("action_tickets")
        .select("id, caller_number, caller_name, summary, status, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(CONTACTS_TICKET_LIMIT),
      supabase
        .from("clients")
        .select("id, phone_e164, name, email, notes, created_at")
        .eq("organization_id", organizationId)
        .limit(CONTACTS_CLIENT_LIMIT),
    ]);

  const ticketsByKey = buildTicketsByKey((ticketData ?? []) as TicketRow[]);
  const clientsByKey = buildClientsByKey((clientData ?? []) as ClientRow[]);
  const categoryLabels = dashboardVerticalCopy(
    orgRow?.niche,
    orgRow?.agent_business_type,
  ).actionInbox.categoryLabels;
  const contacts = !callError
    ? buildContactsFromCalls(
        (callData ?? []) as CallRow[],
        ticketsByKey,
        clientsByKey,
        categoryLabels,
      )
    : [];

  const metrics = buildContactsMetrics(contacts);

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
      <DashboardAnimatedPageSections>
      <ClistePageHeader
        tone="clients"
        icon={Users}
        title="Clients"
        description="Everyone who has called or is saved on your client list, with call history and open follow-ups."
        summary={[
          {
            value: String(metrics.totalContacts),
            label: metrics.totalContacts === 1 ? "contact" : "contacts",
          },
          { value: String(metrics.repeatCallers), label: "repeat" },
          { value: String(metrics.openFollowUps), label: "open follow-ups" },
          { value: String(metrics.newContacts), label: "new this week" },
        ]}
      />

      {callError ? (
        <p className="shrink-0 text-[13px] text-red-700">
          Could not load contacts: {callError.message}
        </p>
      ) : (
        <ContactsView className="min-h-0 flex-1" contacts={contacts} metrics={metrics} />
      )}
      </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
