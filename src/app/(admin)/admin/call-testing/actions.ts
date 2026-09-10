"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSessionUser } from "@/lib/admin-session";
import { syncMissingTestCallReports } from "@/lib/call-testing-sync";
import { createAdminClient } from "@/utils/supabase/admin";

export type CallTestProfileInput = {
  name: string;
  description?: string | null;
  voice_id?: string | null;
  llm_model?: string | null;
  stt_model?: string | null;
  tts_model?: string | null;
  llm_provider?: string | null;
};

export async function createCallTestProfile(
  input: CallTestProfileInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireAdminSessionUser();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("call_test_profiles")
    .insert({
      name,
      description: input.description?.trim() || null,
      voice_id: input.voice_id?.trim() || null,
      llm_model: input.llm_model?.trim() || null,
      stt_model: input.stt_model?.trim() || null,
      tts_model: input.tts_model?.trim() || null,
      llm_provider: input.llm_provider?.trim() || null,
      is_active: false,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Failed to create profile" };
  }

  revalidatePath("/admin/call-testing");
  return { ok: true, id: String(data.id) };
}

export async function activateCallTestProfile(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdminSessionUser();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = profileId.trim();
  if (!id) return { ok: false, error: "Profile id required" };

  const admin = createAdminClient();
  const { error: clearErr } = await admin
    .from("call_test_profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true);

  if (clearErr) {
    return { ok: false, error: clearErr.message };
  }

  const { error } = await admin
    .from("call_test_profiles")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/call-testing");
  return { ok: true };
}

export async function updateCallTestProfile(
  profileId: string,
  input: CallTestProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdminSessionUser();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = profileId.trim();
  const name = input.name.trim();
  if (!id || !name) return { ok: false, error: "Profile id and name required" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("call_test_profiles")
    .update({
      name,
      description: input.description?.trim() || null,
      voice_id: input.voice_id?.trim() || null,
      llm_model: input.llm_model?.trim() || null,
      stt_model: input.stt_model?.trim() || null,
      tts_model: input.tts_model?.trim() || null,
      llm_provider: input.llm_provider?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/call-testing");
  return { ok: true };
}

/** Rebuild test reports from recent call_logs on the test line (pulls pipeline incidents). */
export async function rebuildRecentTestCallReports(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  try {
    await requireAdminSessionUser();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const count = await syncMissingTestCallReports(admin, { sinceHours: 24 * 7, limit: 20 });

  revalidatePath("/admin/call-testing");
  return { ok: true, count };
}
