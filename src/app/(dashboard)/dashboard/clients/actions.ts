"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DeleteClientResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Permanently removes a CRM customer: deletes the auth user (service role),
 * which cascades to their `profiles` row. Dashboard users only have
 * select/update on `profiles`, so this must run on the server.
 */
export async function deleteClient(
  customerId: string
): Promise<DeleteClientResult> {
  const id = customerId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid client id." };
  }

  const session = await requireDashboardSession();

  if (id === session.user.id) {
    return {
      ok: false,
      message: "You cannot remove your own account from the clients list.",
    };
  }
  const { data: me, error: meError } = await session.supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();
  if (meError || me?.role !== "admin") {
    return {
      ok: false,
      message: "Only organization admins can remove clients.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Server is missing Supabase service role configuration.",
    };
  }

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", id)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "Client not found." };
  }
  if (target.organization_id !== session.organizationId) {
    return {
      ok: false,
      message: "This client does not belong to your organization.",
    };
  }
  if (target.role !== "customer") {
    return {
      ok: false,
      message: "Only customer profiles can be removed here.",
    };
  }

  const { error: delError } = await admin.auth.admin.deleteUser(id);
  if (delError) {
    return { ok: false, message: delError.message };
  }

  revalidatePath("/dashboard/clients");
  return { ok: true };
}
