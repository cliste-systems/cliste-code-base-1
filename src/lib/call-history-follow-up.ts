export type CallFollowUpLink = {
  id: string;
  summary: string;
  status: "open" | "resolved";
};

/** Max time after a call starts that an open ticket may be linked to that call. */
export const TICKET_CALL_LINK_MS = 2 * 60 * 60 * 1000;

export function phoneKeyForCallHistory(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

type CallLinkRow = { id: string; caller_number: string; created_at: string };
type TicketLinkRow = {
  id: string;
  caller_number: string;
  summary: string;
  status: string;
  created_at: string;
};

/** Links each open ticket to the single best-matching call (same number, closest time). */
export function assignOpenTicketsToCalls(
  calls: CallLinkRow[],
  tickets: TicketLinkRow[],
): Map<string, CallFollowUpLink> {
  const followUpByCallId = new Map<string, CallFollowUpLink>();
  const openTickets = tickets.filter((t) => t.status === "open");
  const sortedCalls = [...calls].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const ticket of openTickets) {
    const ticketKey = phoneKeyForCallHistory(ticket.caller_number);
    if (!ticketKey) continue;

    const ticketTs = new Date(ticket.created_at).getTime();
    if (!Number.isFinite(ticketTs)) continue;

    let bestCallId: string | null = null;
    let bestDelta = Infinity;

    for (const call of sortedCalls) {
      if (followUpByCallId.has(call.id)) continue;
      if (phoneKeyForCallHistory(call.caller_number) !== ticketKey) continue;

      const callTs = new Date(call.created_at).getTime();
      if (!Number.isFinite(callTs)) continue;
      if (ticketTs < callTs - 60_000) continue;
      if (ticketTs - callTs > TICKET_CALL_LINK_MS) continue;

      const delta = ticketTs - callTs;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestCallId = call.id;
      }
    }

    if (bestCallId) {
      followUpByCallId.set(bestCallId, {
        id: ticket.id,
        summary: ticket.summary,
        status: "open",
      });
    }
  }

  return followUpByCallId;
}
