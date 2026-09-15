import "server-only";

import {
  CALL_RECORDINGS_BUCKET,
  callRecordingContentType,
  isValidCallRecordingStoragePath,
} from "@/lib/call-recordings";
import { createAdminClient } from "@/utils/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 300;

export async function createCallRecordingSignedUrl(input: {
  organizationId: string;
  callLogId: string;
  storagePath: string;
}): Promise<string | null> {
  if (
    !isValidCallRecordingStoragePath(input.storagePath, input.organizationId)
  ) {
    return null;
  }

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("call_logs")
    .select("id")
    .eq("id", input.callLogId)
    .eq("organization_id", input.organizationId)
    .eq("audio_storage_path", input.storagePath)
    .maybeSingle();

  if (rowError || !row?.id) return null;

  const { data, error } = await admin.storage
    .from(CALL_RECORDINGS_BUCKET)
    .createSignedUrl(input.storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteCallRecordingObjects(
  storagePaths: string[],
): Promise<number> {
  const paths = [...new Set(storagePaths.map((p) => p.trim()).filter(Boolean))];
  if (paths.length === 0) return 0;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(CALL_RECORDINGS_BUCKET)
    .remove(paths);

  if (error) {
    console.error("[call-recordings] storage remove failed", error.message);
    return 0;
  }

  return data?.length ?? paths.length;
}

export async function uploadCallRecordingFromWorker(input: {
  organizationId: string;
  callLogId: string;
  storagePath: string;
  body: Buffer | Uint8Array;
}): Promise<boolean> {
  if (
    !isValidCallRecordingStoragePath(input.storagePath, input.organizationId)
  ) {
    return false;
  }

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(CALL_RECORDINGS_BUCKET)
    .upload(input.storagePath, input.body, {
      contentType: callRecordingContentType(input.storagePath),
      upsert: true,
    });

  if (error) {
    console.error("[call-recordings] upload failed", error.message);
    return false;
  }

  const { error: patchError } = await admin
    .from("call_logs")
    .update({ audio_storage_path: input.storagePath })
    .eq("id", input.callLogId)
    .eq("organization_id", input.organizationId);

  if (patchError) {
    console.error("[call-recordings] call_logs patch failed", patchError.message);
    return false;
  }

  return true;
}
