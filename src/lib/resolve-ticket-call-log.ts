import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CALL_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

export type TicketCallLinkInput = {
  id: string;
  call_log_id?: string | null;
  caller_number: string;
  created_at: string;
};

export type TicketCallLink = {
  callLogId: string | null;
  callCreatedAt: string | null;
};

function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

function isUuid(value: string | null | undefined): value is string {
  const trimmed = String(value ?? "").trim();
  return Boolean(trimmed && UUID_RE.test(trimmed));
}

/**
 * Resolve the originating call for action tickets — uses stored call_log_id when
 * present, otherwise matches caller + time window (older tickets).
 */
export async function resolveTicketCallLinks(
  supabase: SupabaseClient,
  organizationId: string,
  tickets: TicketCallLinkInput[],
): Promise<Map<string, TicketCallLink>> {
  const links = new Map<string, TicketCallLink>();
  if (tickets.length === 0) return links;

  for (const ticket of tickets) {
    links.set(ticket.id, { callLogId: null, callCreatedAt: null });
  }

  const linkedIds = [
    ...new Set(
      tickets
        .map((ticket) => String(ticket.call_log_id ?? "").trim())
        .filter((id) => isUuid(id)),
    ),
  ];

  const callCreatedAtById = new Map<string, string>();
  if (linkedIds.length > 0) {
    const { data: linkedCalls } = await supabase
      .from("call_logs")
      .select("id, created_at")
      .eq("organization_id", organizationId)
      .in("id", linkedIds);

    for (const row of linkedCalls ?? []) {
      const id = String(row.id ?? "").trim();
      const createdAt = String(row.created_at ?? "").trim();
      if (id && createdAt) {
        callCreatedAtById.set(id, createdAt);
      }
    }
  }

  for (const ticket of tickets) {
    const linkedId = String(ticket.call_log_id ?? "").trim();
    if (!isUuid(linkedId)) continue;
    links.set(ticket.id, {
      callLogId: linkedId,
      callCreatedAt: callCreatedAtById.get(linkedId) ?? ticket.created_at,
    });
  }

  const orphans = tickets.filter((ticket) => {
    const linkedId = String(ticket.call_log_id ?? "").trim();
    return !isUuid(linkedId);
  });
  if (orphans.length === 0) return links;

  const ticketTimes = orphans
    .map((ticket) => new Date(ticket.created_at).getTime())
    .filter((value) => !Number.isNaN(value));
  if (ticketTimes.length === 0) return links;

  const windowStart = new Date(
    Math.min(...ticketTimes) - CALL_MATCH_WINDOW_MS,
  ).toISOString();
  const windowEnd = new Date(Math.max(...ticketTimes)).toISOString();

  const { data: callsInWindow } = await supabase
    .from("call_logs")
    .select("id, caller_number, created_at")
    .eq("organization_id", organizationId)
    .eq("is_test_call", false)
    .eq("engineer_test_call", false)
    .gte("created_at", windowStart)
    .lte("created_at", windowEnd)
    .order("created_at", { ascending: false });

  const callsByPhone = new Map<string, Array<{ id: string; created_at: string }>>();
  for (const row of callsInWindow ?? []) {
    const key = phoneKey(row.caller_number);
    const id = String(row.id ?? "").trim();
    const createdAt = String(row.created_at ?? "").trim();
    if (!key || !id || !createdAt) continue;
    const bucket = callsByPhone.get(key) ?? [];
    bucket.push({ id, created_at: createdAt });
    callsByPhone.set(key, bucket);
  }

  for (const ticket of orphans) {
    const key = phoneKey(ticket.caller_number);
    const ticketAt = new Date(ticket.created_at).getTime();
    if (!key || Number.isNaN(ticketAt)) continue;

    const windowStartMs = ticketAt - CALL_MATCH_WINDOW_MS;
    const candidates = (callsByPhone.get(key) ?? [])
      .filter((call) => {
        const callAt = new Date(call.created_at).getTime();
        return callAt >= windowStartMs && callAt <= ticketAt;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    const match = candidates[0];
    if (!match) continue;

    links.set(ticket.id, {
      callLogId: match.id,
      callCreatedAt: match.created_at,
    });
  }

  return links;
}

export async function resolveCallLogIdForTicket(
  supabase: SupabaseClient,
  organizationId: string,
  ticketId: string,
): Promise<string | null> {
  const { data: ticket, error } = await supabase
    .from("action_tickets")
    .select("id, call_log_id, caller_number, created_at")
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !ticket) return null;

  const links = await resolveTicketCallLinks(supabase, organizationId, [
    {
      id: ticket.id,
      call_log_id: ticket.call_log_id,
      caller_number: ticket.caller_number,
      created_at: ticket.created_at,
    },
  ]);

  return links.get(ticket.id)?.callLogId ?? null;
}
