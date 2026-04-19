"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const E164_RE = /^\+[1-9]\d{6,14}$/;

function normalizePhoneToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
    else if (digits.startsWith("0")) digits = `+353${digits.slice(1)}`;
    else digits = `+${digits}`;
  }
  if (!E164_RE.test(digits)) return null;
  return digits;
}

export type DeleteClientResult =
  | { ok: true }
  | { ok: false; message: string };

export type CreateClientResult =
  | { ok: true; clientId: string }
  | { ok: false; message: string };

export type UpdateClientResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Permanently removes a CRM customer:
 * - For canonical clients (`public.clients`), deletes the row. Existing
 *   appointments keep history because `appointments.client_id` is
 *   `on delete set null`.
 * - For legacy auth-user customers (`profiles.role = 'customer'`), deletes
 *   the auth user so the cascade clears their `profiles` row.
 */
export async function deleteClient(
  clientOrProfileId: string,
): Promise<DeleteClientResult> {
  const id = clientOrProfileId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid client id." };
  }

  const session = await requireDashboardSession();

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

  const { data: clientRow, error: clientLookup } = await session.supabase
    .from("clients")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (clientLookup) return { ok: false, message: clientLookup.message };

  if (clientRow) {
    if (clientRow.organization_id !== session.organizationId) {
      return {
        ok: false,
        message: "This client does not belong to your organization.",
      };
    }
    const { error: delErr } = await session.supabase
      .from("clients")
      .delete()
      .eq("id", id);
    if (delErr) return { ok: false, message: delErr.message };

    revalidatePath("/dashboard/clients");
    return { ok: true };
  }

  if (id === session.user.id) {
    return {
      ok: false,
      message: "You cannot remove your own account from the clients list.",
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

export async function createClient(payload: {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  allergies?: string | null;
}): Promise<CreateClientResult> {
  const name = payload.name.trim();
  if (name.length < 2) {
    return { ok: false, message: "Name is required." };
  }
  const phoneE164 = normalizePhoneToE164(payload.phone);
  if (!phoneE164) {
    return {
      ok: false,
      message:
        "Enter a valid phone number including the country code (e.g. +353 87 1234567).",
    };
  }
  const email =
    payload.email && payload.email.trim().length > 0
      ? payload.email.trim().toLowerCase()
      : null;
  const notes =
    payload.notes && payload.notes.trim().length > 0
      ? payload.notes.trim()
      : null;
  const allergies =
    payload.allergies && payload.allergies.trim().length > 0
      ? payload.allergies.trim()
      : null;

  const { supabase, organizationId } = await requireDashboardSession();

  const { data: existing, error: lookupErr } = await supabase
    .from("clients")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone_e164", phoneE164)
    .maybeSingle();
  if (lookupErr) return { ok: false, message: lookupErr.message };

  if (existing) {
    const { error: updateErr } = await supabase
      .from("clients")
      .update({
        name,
        email,
        notes,
        allergies,
      })
      .eq("id", existing.id);
    if (updateErr) return { ok: false, message: updateErr.message };
    revalidatePath("/dashboard/clients");
    return { ok: true, clientId: existing.id };
  }

  const { data: created, error: insertErr } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      name,
      phone_e164: phoneE164,
      email,
      notes,
      allergies,
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    return {
      ok: false,
      message: insertErr?.message ?? "Could not create client.",
    };
  }

  revalidatePath("/dashboard/clients");
  return { ok: true, clientId: created.id };
}

export async function updateClient(payload: {
  clientId: string;
  name?: string;
  email?: string | null;
  notes?: string | null;
  allergies?: string | null;
}): Promise<UpdateClientResult> {
  const id = payload.clientId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid client id." };
  }

  const update: Record<string, string | null> = {};
  if (typeof payload.name === "string") {
    const trimmed = payload.name.trim();
    if (trimmed.length < 2) {
      return { ok: false, message: "Name is required." };
    }
    update.name = trimmed;
  }
  if (payload.email !== undefined) {
    const trimmed = payload.email?.trim() ?? "";
    update.email = trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }
  if (payload.notes !== undefined) {
    const trimmed = payload.notes?.trim() ?? "";
    update.notes = trimmed.length > 0 ? trimmed : null;
  }
  if (payload.allergies !== undefined) {
    const trimmed = payload.allergies?.trim() ?? "";
    update.allergies = trimmed.length > 0 ? trimmed : null;
  }

  if (Object.keys(update).length === 0) {
    return { ok: true };
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const { error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/clients");
  return { ok: true };
}
