"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SUBJECT = 200;
const MAX_BODY = 8000;

export type CreateSupportTicketResult =
  | { ok: true }
  | { ok: false; message: string };

export async function createSupportTicket(payload: {
  subject: string;
  body: string;
}): Promise<CreateSupportTicketResult> {
  const subject = payload.subject.trim();
  const body = payload.body.trim();

  if (!subject) {
    return { ok: false, message: "Please enter a subject." };
  }
  if (subject.length > MAX_SUBJECT) {
    return { ok: false, message: `Subject must be at most ${MAX_SUBJECT} characters.` };
  }
  if (!body) {
    return { ok: false, message: "Please describe what you need help with." };
  }
  if (body.length > MAX_BODY) {
    return { ok: false, message: `Message must be at most ${MAX_BODY} characters.` };
  }

  const { supabase, organizationId, user } = await requireDashboardSession();

  const { error } = await supabase.from("support_tickets").insert({
    organization_id: organizationId,
    created_by: user.id,
    subject,
    body,
    status: "open",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/support");
  revalidatePath("/admin/support");
  revalidatePath("/admin");
  return { ok: true };
}

export type ReplySupportTicketResult =
  | { ok: true }
  | { ok: false; message: string };

export async function replyToSupportTicket(payload: {
  ticketId: string;
  body: string;
}): Promise<ReplySupportTicketResult> {
  const ticketId = payload.ticketId.trim();
  const body = payload.body.trim();

  if (!UUID_RE.test(ticketId)) {
    return { ok: false, message: "Invalid ticket." };
  }
  if (!body) {
    return { ok: false, message: "Please enter a message." };
  }
  if (body.length > MAX_BODY) {
    return { ok: false, message: `Message must be at most ${MAX_BODY} characters.` };
  }

  const { supabase, organizationId, user } = await requireDashboardSession();

  const { data: ticket, error: ticketErr } = await supabase
    .from("support_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (ticketErr || !ticket) {
    return { ok: false, message: ticketErr?.message ?? "Ticket not found." };
  }

  const wasClosed = ticket.status === "closed";

  const { error: insErr } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    author_kind: "salon",
    body,
    created_by: user.id,
  });

  if (insErr) {
    return { ok: false, message: insErr.message };
  }

  if (wasClosed) {
    await supabase.rpc("support_ticket_reopen_if_closed", {
      p_ticket_id: ticketId,
    });
  }

  revalidatePath("/dashboard/support");
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin");
  return { ok: true };
}
