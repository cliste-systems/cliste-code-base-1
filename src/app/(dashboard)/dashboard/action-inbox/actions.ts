"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markTicketResolved(formData: FormData): Promise<void> {
  const ticketId = formData.get("ticketId");
  if (typeof ticketId !== "string" || !UUID_RE.test(ticketId)) return;

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: row } = await supabase
    .from("action_tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!row) return;

  const { error } = await supabase
    .from("action_tickets")
    .update({ status: "resolved" })
    .eq("id", ticketId)
    .eq("organization_id", organizationId);

  if (error) return;

  revalidatePath("/dashboard/action-inbox");
  revalidatePath("/dashboard");
}
