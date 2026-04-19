import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CancelConfirmedAppointmentResult =
  | { ok: true; didPerformCancellation: boolean }
  | { ok: false; message: string };

/**
 * Cancels a confirmed appointment for the tenant (RLS must already scope the client).
 * Shared by dashboard server actions and Cara confirm API.
 */
export async function cancelConfirmedAppointmentForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  appointmentId: string,
  options?: { reason?: string | null; cancelledBy?: string | null },
): Promise<CancelConfirmedAppointmentResult> {
  const id = appointmentId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid appointment id." };
  }

  const { data: row, error: loadErr } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, message: loadErr.message };
  }
  if (!row) {
    return { ok: false, message: "Appointment not found." };
  }
  if (row.status === "cancelled") {
    return { ok: true, didPerformCancellation: false };
  }
  if (row.status !== "confirmed") {
    return {
      ok: false,
      message: "Only confirmed appointments can be cancelled.",
    };
  }

  const reasonRaw = options?.reason ?? null;
  const reason =
    typeof reasonRaw === "string"
      ? reasonRaw.trim().slice(0, 200) || null
      : null;
  const cancelledBy = options?.cancelledBy ?? null;

  const { error: updErr } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (updErr) {
    return { ok: false, message: updErr.message };
  }

  return { ok: true, didPerformCancellation: true };
}
