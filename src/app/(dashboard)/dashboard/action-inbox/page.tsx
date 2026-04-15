import { CheckCircle2, Inbox } from "lucide-react";

import { requireDashboardSession } from "@/lib/dashboard-session";

import {
  ActionInboxView,
  type ActionInboxTicket,
} from "./action-inbox-view";

type ActionTicketRow = {
  id: string;
  caller_number: string;
  summary: string;
  status: string;
  created_at: string;
};

function partitionTickets(rows: ActionTicketRow[]): {
  open: ActionInboxTicket[];
  resolved: ActionInboxTicket[];
} {
  const open: ActionInboxTicket[] = [];
  const resolved: ActionInboxTicket[] = [];
  for (const row of rows) {
    const t: ActionInboxTicket = {
      id: row.id,
      callerNumber: row.caller_number,
      summary: row.summary,
      createdAt: row.created_at,
    };
    if (row.status === "resolved") resolved.push(t);
    else open.push(t);
  }
  return { open, resolved };
}

function InboxPageHeader() {
  return (
    <header className="mb-8">
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-gray-500 uppercase">
        <Inbox className="size-3.5 shrink-0" aria-hidden />
        Operations
      </div>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900">
        Action Inbox
      </h1>
      <p className="max-w-2xl text-sm font-medium leading-relaxed text-gray-500">
        Edge cases the AI could not close on the call — patch tests, medical
        questions, and complex requests land here for your team. Use the tabs
        below to switch between open items and history.
      </p>
    </header>
  );
}

export default async function ActionInboxPage() {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data, error } = await supabase
    .from("action_tickets")
    .select("id, caller_number, summary, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const rows = (error ? [] : (data ?? [])) as ActionTicketRow[];
  const { open, resolved } = partitionTickets(rows);

  return (
    <div className="-mx-6 -mt-8 flex min-h-0 flex-1 flex-col bg-[#FAFAFA] px-6 pb-12 pt-8 lg:-mx-12 lg:px-12 lg:pt-10">
      <div className="mx-auto max-w-[1000px]">
        <InboxPageHeader />

        {error ? (
          <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <p className="text-sm font-semibold text-red-700">
              Could not load action tickets
            </p>
            <p className="mt-2 text-sm text-gray-600">{error.message}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="relative flex min-h-[440px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-50/50 via-white to-white"
              aria-hidden
            />
            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-5 text-gray-300">
                <CheckCircle2
                  className="size-16 stroke-[1]"
                  strokeWidth={1}
                  aria-hidden
                />
              </div>
              <h2 className="mb-2 text-base font-semibold tracking-tight text-gray-900">
                No actions required
              </h2>
              <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-gray-500">
                There are no tickets in your inbox. New items from calls will
                appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <ActionInboxView openTickets={open} resolvedTickets={resolved} />
        )}
      </div>
    </div>
  );
}
