import { requireDashboardSession } from "@/lib/dashboard-session";

import { SupportView, type SupportTicketListRow } from "./support-view";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: rows, error } = await supabase
    .from("support_tickets")
    .select(
      `id, subject, body, status, created_at,
       support_ticket_messages ( id, author_kind, body, created_at )`
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const tickets: SupportTicketListRow[] =
    !error && rows
      ? (rows as SupportTicketListRow[]).map((row) => ({
          ...row,
          support_ticket_messages: [
            ...(row.support_ticket_messages ?? []),
          ].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          ),
        }))
      : [];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-gray-50 pb-2">
      {error ? (
        <p className="text-destructive px-3 py-4 text-sm sm:px-4">
          {error.message}
          {error.message.includes("support_tickets") ||
          error.message.includes("support_ticket_messages")
            ? " — run the latest Supabase migrations (support tables)."
            : null}
        </p>
      ) : (
        <SupportView initialTickets={tickets} />
      )}
    </div>
  );
}
