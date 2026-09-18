import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { serializeBusinessHours } from "@/lib/business-hours";
import { recordCaraKnowledgeEvent } from "@/lib/cara-knowledge-events";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  buildHoursOverrideForDraft,
} from "@/lib/cara-knowledge-temporal-subjects";
import type { TemporalDraftInput, TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import {
  buildTemporalWindow,
  findTemporalConflicts,
  isTemporalUpdateEffective,
  isTemporalUpdateVisible,
  parseTemporalDraft,
  resolveBusinessTimezone,
  rowToTemporalUpdate,
  validateTemporalWindow,
} from "@/lib/cara-knowledge-temporal";
import { upsertKnowledgeEntryClassification } from "@/lib/cara-knowledge-folder-assignments";

function isSchemaCacheError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("relation")
  );
}

export async function loadTemporalUpdatesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TemporalUpdateRecord[]> {
  const { data, error } = await supabase
    .from("cara_knowledge_temporal_updates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("effective_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isSchemaCacheError(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    rowToTemporalUpdate(row as Record<string, unknown>),
  );
}

export async function loadVisibleTemporalUpdatesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  now: Date = new Date(),
): Promise<TemporalUpdateRecord[]> {
  const rows = await loadTemporalUpdatesForOrg(supabase, organizationId);
  return rows.filter((row) => isTemporalUpdateVisible(row, now));
}

export async function loadEffectiveTemporalUpdatesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  now: Date = new Date(),
): Promise<TemporalUpdateRecord[]> {
  const rows = await loadTemporalUpdatesForOrg(supabase, organizationId);
  return rows.filter((row) => isTemporalUpdateEffective(row, now));
}

export async function saveTrainingTemporalDraft(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    itemId: string;
    draft: TemporalDraftInput;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("cara_training_items")
    .update({
      temporal_draft: input.draft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("organization_id", input.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function activateTemporalDraftForTrainingItem(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  input: {
    organizationId: string;
    itemId: string;
    actorId: string;
    ownerAnswer?: string | null;
  },
): Promise<{ ok: true; updateId: string } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("temporal_draft, gap_summary")
    .eq("id", input.itemId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const draft = parseTemporalDraft(row.temporal_draft);
  if (!draft) {
    return { ok: false, message: "No temporary update is configured." };
  }

  if (input.ownerAnswer?.trim()) {
    draft.body = input.ownerAnswer.trim();
    if (draft.overridePreview) {
      draft.overridePreview.temporaryBody = draft.body;
    }
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("business_hours, agent_opening_hours")
    .eq("id", input.organizationId)
    .maybeSingle();

  const timezone = resolveBusinessTimezone(null);
  const window = buildTemporalWindow(draft, timezone);
  const validation = validateTemporalWindow(window, draft.durationMode);
  if (!validation.ok) return validation;

  const existing = await loadTemporalUpdatesForOrg(supabase, input.organizationId);
  const conflicts = findTemporalConflicts(existing, {
    subjectRef: draft.subjectRef ?? null,
    subjectType: draft.subjectType,
    effectiveAt: window.effectiveAt,
    expiresAt: window.expiresAt,
  });
  if (conflicts.length > 0) {
    return {
      ok: false,
      message:
        "Another temporary update already covers this topic in the same period. Edit or end the existing update first.",
    };
  }

  let hoursOverrideId: string | null = null;
  const hoursOverride = buildHoursOverrideForDraft({
    draft,
    businessHours: org?.business_hours,
    timezone,
  });
  if (hoursOverride) {
    const { data: inserted, error: hoursError } = await admin
      .from("business_hours_overrides")
      .insert({
        organization_id: input.organizationId,
        label: hoursOverride.label,
        schedule: serializeBusinessHours(hoursOverride.schedule),
        expires_at: hoursOverride.expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (hoursError || !inserted?.id) {
      return { ok: false, message: hoursError?.message ?? "Could not save hours override." };
    }
    hoursOverrideId = String(inserted.id);
  }

  const now = new Date().toISOString();
  const { data: insertedUpdate, error: insertError } = await supabase
    .from("cara_knowledge_temporal_updates")
    .insert({
      organization_id: input.organizationId,
      title: draft.title,
      body: draft.body,
      subject_type: draft.subjectType,
      subject_ref: draft.subjectRef,
      subject_scope: draft.subjectScope ?? {},
      override_preview: draft.overridePreview,
      duration_mode: draft.durationMode,
      effective_at: window.effectiveAt.toISOString(),
      expires_at: window.expiresAt?.toISOString() ?? null,
      review_reminder_at: window.reviewReminderAt?.toISOString() ?? null,
      hours_override_id: hoursOverrideId,
      training_item_id: input.itemId,
      classification: draft.classification ?? {},
      created_by: input.actorId,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError || !insertedUpdate?.id) {
    return { ok: false, message: insertError?.message ?? "Could not save temporary update." };
  }

  const updateId = String(insertedUpdate.id);

  if (draft.classification) {
    await upsertKnowledgeEntryClassification(supabase, {
      organizationId: input.organizationId,
      entryId: `temporal-${updateId}`,
      classification: {
        folderId: draft.classification.folderId,
        departmentIds: draft.classification.departmentIds ?? [],
        topicLabels: draft.classification.topicLabels ?? [],
      },
      actorId: input.actorId,
      title: draft.title,
      category: draft.subjectType === "opening_hours" ? "facts" : "policies",
      source: "temporal_update",
    });
  }

  await recordCaraKnowledgeEvent(supabase, {
    organizationId: input.organizationId,
    eventType: "temporal_started",
    category: draft.subjectType,
    title: draft.title,
    payload: {
      temporalUpdateId: updateId,
      subjectRef: draft.subjectRef,
      effectiveAt: window.effectiveAt.toISOString(),
      expiresAt: window.expiresAt?.toISOString() ?? null,
    },
    source: "owner_initiated",
    actorId: input.actorId,
    trainingItemId: input.itemId,
  });

  const regen = await regenerateCaraCustomPrompt(supabase, input.organizationId);
  if (!regen.ok) {
    return regen;
  }

  return { ok: true, updateId };
}

export async function endTemporalUpdateNow(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  input: {
    organizationId: string;
    updateId: string;
    actorId: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_knowledge_temporal_updates")
    .select("*")
    .eq("id", input.updateId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Temporary update not found." };
  }

  const update = rowToTemporalUpdate(row as Record<string, unknown>);
  const now = new Date().toISOString();

  if (update.hoursOverrideId) {
    await admin
      .from("business_hours_overrides")
      .update({ expires_at: now })
      .eq("id", update.hoursOverrideId)
      .eq("organization_id", input.organizationId);
  }

  const { error: updateError } = await supabase
    .from("cara_knowledge_temporal_updates")
    .update({
      ended_at: now,
      updated_at: now,
    })
    .eq("id", input.updateId)
    .eq("organization_id", input.organizationId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await recordCaraKnowledgeEvent(supabase, {
    organizationId: input.organizationId,
    eventType: "temporal_ended",
    category: update.subjectType,
    title: update.title,
    payload: { temporalUpdateId: update.id, manual: true },
    source: "owner_initiated",
    actorId: input.actorId,
    trainingItemId: update.trainingItemId,
  });

  const regen = await regenerateCaraCustomPrompt(supabase, input.organizationId);
  if (!regen.ok) return regen;
  return { ok: true };
}

export async function cancelScheduledTemporalUpdate(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    updateId: string;
    actorId: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("cara_knowledge_temporal_updates")
    .update({
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", input.updateId)
    .eq("organization_id", input.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await recordCaraKnowledgeEvent(supabase, {
    organizationId: input.organizationId,
    eventType: "temporal_cancelled",
    title: "Scheduled update cancelled",
    payload: { temporalUpdateId: input.updateId },
    source: "owner_initiated",
    actorId: input.actorId,
  });

  return { ok: true };
}

export function shouldSkipPermanentPatchForTemporal(
  draft: TemporalDraftInput | null,
): boolean {
  if (!draft) return false;
  return (
    draft.subjectType === "opening_hours" ||
    draft.subjectType === "notice" ||
    draft.subjectType === "availability" ||
    draft.subjectType === "price"
  );
}
