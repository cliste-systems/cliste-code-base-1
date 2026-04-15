import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/utils/supabase/admin";

import { SupportThreadMessages } from "@/components/support/support-thread-messages";

import { CloseSupportButton } from "../close-support-button";
import { TicketAdminReplyForm } from "../ticket-admin-reply-form";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrgJoin = { name: string; slug: string };

type MessageRow = {
  id: string;
  author_kind: string;
  body: string;
  created_at: string;
};

type TicketDetail = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  organization_id: string;
  organizations: OrgJoin | OrgJoin[] | null;
  support_ticket_messages: MessageRow[] | null;
};

function orgLabel(ticket: TicketDetail): string {
  const o = ticket.organizations;
  if (!o) return "—";
  const one = Array.isArray(o) ? o[0] : o;
  return one?.name?.trim() || "—";
}

function orgSlug(ticket: TicketDetail): string | null {
  const o = ticket.organizations;
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

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  if (!UUID_RE.test(ticketId)) notFound();

  let ticket: TicketDetail | null = null;
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("support_tickets")
      .select(
        `id, subject, body, status, created_at, organization_id,
         organizations ( name, slug ),
         support_ticket_messages ( id, author_kind, body, created_at )`
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    ticket = data as TicketDetail | null;
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load ticket.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
        <Link
          href="/admin/support"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All tickets
        </Link>
        <p className="text-destructive text-sm">{loadError}</p>
      </div>
    );
  }

  if (!ticket) notFound();

  const rawMessages = ticket.support_ticket_messages ?? [];
  const messages = [...rawMessages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      <Link
        href="/admin/support"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase">
            {orgLabel(ticket)}
            {orgSlug(ticket) ? (
              <span className="text-muted-foreground ml-2 font-mono normal-case">
                {orgSlug(ticket)}
              </span>
            ) : null}
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
            {ticket.subject}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            Opened {formatWhen(ticket.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={ticket.status === "open" ? "default" : "secondary"}
            className="capitalize"
          >
            {ticket.status}
          </Badge>
          {ticket.status === "open" ? (
            <CloseSupportButton ticketId={ticket.id} />
          ) : null}
        </div>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription>
            Original request and all replies. The salon sees this on Support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SupportThreadMessages
            openedAt={ticket.created_at}
            initialBody={ticket.body}
            messages={messages}
            perspective="admin"
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Add reply</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketAdminReplyForm ticketId={ticket.id} />
        </CardContent>
      </Card>
    </div>
  );
}
