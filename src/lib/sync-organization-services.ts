import type { SupabaseClient } from "@supabase/supabase-js";

import { servicesTableHasExtendedColumns } from "@/lib/services-schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OrganizationServiceSyncInput = {
  id?: string;
  name: string;
  category: string;
  priceEur: string;
  durationMin: string;
  description: string;
  aiVoiceNotes: string;
  isPublished: boolean;
  categoryId?: string | null;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  depositRequired?: boolean;
  depositAmountCents?: number | null;
  depositPercent?: number | null;
  /** Active stylist time before processing kicks off. */
  processingBeforeMin?: number;
  /** Hands-off processing window (e.g. colour develops). */
  processingMin?: number;
  /** Active stylist time after processing. */
  processingAfterMin?: number;
};

export type SyncOrganizationServicesResult =
  | { ok: true; warning?: string }
  | { ok: false; message: string };

/**
 * Upserts named services first, then deletes removed rows. Appointments that reference
 * a removed service are deleted first (same org), so the service row can be removed.
 */
export async function syncOrganizationServices(
  client: SupabaseClient,
  organizationId: string,
  services: OrganizationServiceSyncInput[]
): Promise<SyncOrganizationServicesResult> {
  const extended = await servicesTableHasExtendedColumns(client);

  const { data: existingSvc, error: existingSvcErr } = await client
    .from("services")
    .select("id")
    .eq("organization_id", organizationId);

  if (existingSvcErr) {
    return { ok: false, message: existingSvcErr.message };
  }

  const originalExistingIds = new Set(
    (existingSvc ?? []).map((r) => r.id as string)
  );

  const named = services.filter((s) => s.name.trim());

  const payloadIds = new Set(
    named
      .map((s) => s.id?.trim() ?? "")
      .filter((sid) => UUID_RE.test(sid))
  );

  const toRemove = [...originalExistingIds].filter((sid) => !payloadIds.has(sid));

  const now = new Date().toISOString();

  for (const s of named) {
    const name = s.name.trim();
    const category = s.category.trim() || null;
    const price = Math.max(0, Number.parseFloat(s.priceEur) || 0);
    const duration_minutes = Math.max(
      0,
      Math.round(Number.parseFloat(s.durationMin) || 0)
    );
    const baseRow = {
      organization_id: organizationId,
      name,
      category,
      price,
      duration_minutes,
      updated_at: now,
    };

    const cleanCents = (v: number | null | undefined): number | null => {
      if (v == null) return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const cleanPercent = (v: number | null | undefined): number | null => {
      if (v == null) return null;
      const n = Math.round(Number(v));
      if (!Number.isFinite(n)) return null;
      if (n < 1 || n > 100) return null;
      return n;
    };
    const cleanBuffer = (v: number | undefined): number => {
      if (v == null) return 0;
      const n = Math.max(0, Math.min(240, Math.round(Number(v) || 0)));
      return n;
    };
    const cleanProcessing = (v: number | undefined): number => {
      if (v == null) return 0;
      const n = Math.max(0, Math.min(480, Math.round(Number(v) || 0)));
      return n;
    };
    const cleanCategoryId = (v: string | null | undefined): string | null => {
      if (!v) return null;
      const t = v.trim();
      return UUID_RE.test(t) ? t : null;
    };
    const depositRequired = Boolean(s.depositRequired);
    const extras = {
      category_id: cleanCategoryId(s.categoryId),
      buffer_before_min: cleanBuffer(s.bufferBeforeMin),
      buffer_after_min: cleanBuffer(s.bufferAfterMin),
      deposit_required: depositRequired,
      deposit_amount_cents: depositRequired ? cleanCents(s.depositAmountCents) : null,
      deposit_percent: depositRequired ? cleanPercent(s.depositPercent) : null,
      processing_before_min: cleanProcessing(s.processingBeforeMin),
      processing_min: cleanProcessing(s.processingMin),
      processing_after_min: cleanProcessing(s.processingAfterMin),
    };

    const row = extended
      ? {
          ...baseRow,
          description: s.description.trim() || null,
          ai_voice_notes: s.aiVoiceNotes.trim() || null,
          is_published: Boolean(s.isPublished),
          ...extras,
        }
      : { ...baseRow, ...extras };

    const sid = s.id?.trim() ?? "";

    if (UUID_RE.test(sid) && originalExistingIds.has(sid)) {
      const { error: updError } = await client
        .from("services")
        .update(row)
        .eq("id", sid)
        .eq("organization_id", organizationId);
      if (updError) {
        return { ok: false, message: updError.message };
      }
    } else {
      const insertRow = UUID_RE.test(sid) ? { ...row, id: sid } : row;
      const { error: insError } = await client.from("services").insert(insertRow);
      if (insError) {
        return { ok: false, message: insError.message };
      }
    }
  }

  if (toRemove.length === 0) {
    return { ok: true };
  }

  const { data: apptRows, error: countErr } = await client
    .from("appointments")
    .select("id")
    .eq("organization_id", organizationId)
    .in("service_id", toRemove);

  if (countErr) {
    return { ok: false, message: countErr.message };
  }

  const apptCount = apptRows?.length ?? 0;

  if (apptCount > 0) {
    const { error: apptDelErr } = await client
      .from("appointments")
      .delete()
      .eq("organization_id", organizationId)
      .in("service_id", toRemove);

    if (apptDelErr) {
      return { ok: false, message: apptDelErr.message };
    }
  }

  const { error: delError } = await client
    .from("services")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", toRemove);

  if (delError) {
    return { ok: false, message: delError.message };
  }

  const warning =
    apptCount > 0
      ? `Removed ${apptCount} booking${apptCount === 1 ? "" : "s"} that used deleted service(s).`
      : undefined;

  return { ok: true, ...(warning ? { warning } : {}) };
}
