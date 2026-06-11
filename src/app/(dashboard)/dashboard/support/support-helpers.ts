export type SupportMessageRow = {
  id: string;
  author_kind: string;
  body: string;
  created_at: string;
};

export type SupportTicketRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  support_ticket_messages?: SupportMessageRow[] | null;
};

export type SupportMetrics = {
  open: number;
  closed: number;
  total: number;
};

export function buildSupportMetrics(tickets: SupportTicketRow[]): SupportMetrics {
  let open = 0;
  let closed = 0;
  for (const t of tickets) {
    if (t.status.toLowerCase() === "closed") closed += 1;
    else open += 1;
  }
  return { open, closed, total: tickets.length };
}

export function formatSupportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ticketListPreview(ticket: SupportTicketRow): string {
  const messages = ticket.support_ticket_messages ?? [];
  const last = messages[messages.length - 1];
  const text = (last?.body ?? ticket.body).trim();
  if (!text) return "No message";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

export function lastActivityAt(ticket: SupportTicketRow): string {
  const messages = ticket.support_ticket_messages ?? [];
  const last = messages[messages.length - 1];
  return last?.created_at ?? ticket.created_at;
}

export function hasAdminReply(ticket: SupportTicketRow): boolean {
  return (ticket.support_ticket_messages ?? []).some(
    (m) => m.author_kind === "admin",
  );
}

export type SupportStatusFilter = "all" | "open" | "closed";

export function matchesSupportFilter(
  ticket: SupportTicketRow,
  filter: SupportStatusFilter,
): boolean {
  if (filter === "all") return true;
  const closed = ticket.status.toLowerCase() === "closed";
  return filter === "closed" ? closed : !closed;
}
