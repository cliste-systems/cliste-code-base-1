import "server-only";

import { randomUUID } from "crypto";

import { extractBusinessFileText } from "@/lib/business-file-extract";
import {
  BUSINESS_FILES_BUCKET,
  BUSINESS_FILE_MIME_TYPES,
  MAX_BUSINESS_FILE_BYTES,
  inferFileType,
  isBusinessFileKind,
  mapBusinessFileRow,
  toBusinessFileListItem,
  type BusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import { createAdminClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUSINESS_FILE_SELECT =
  "id, organization_id, file_name, file_type, mime_type, storage_path, size_bytes, answer_enabled, send_enabled, document_kind, processing_status, extracted_text, created_at, updated_at";

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()+\s]/g, "_").slice(0, 180) || "document";
}

export async function listBusinessFilesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<BusinessFileListItem[]> {
  const { data, error } = await supabase
    .from("business_files")
    .select(BUSINESS_FILE_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) =>
    toBusinessFileListItem(
      mapBusinessFileRow(row as Parameters<typeof mapBusinessFileRow>[0]),
    ),
  );
}

export async function uploadBusinessFileForOrg(input: {
  organizationId: string;
  file: File;
  documentKind?: BusinessFileKind | null;
}): Promise<
  { ok: true; file: BusinessFileListItem } | { ok: false; message: string }
> {
  const { organizationId, file } = input;
  const documentKind =
    input.documentKind && isBusinessFileKind(input.documentKind)
      ? input.documentKind
      : null;

  if (file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  if (file.size > MAX_BUSINESS_FILE_BYTES) {
    return { ok: false, message: "File is too large (max 10 MB)." };
  }

  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  if (
    !BUSINESS_FILE_MIME_TYPES.includes(
      mimeType as (typeof BUSINESS_FILE_MIME_TYPES)[number],
    )
  ) {
    return {
      ok: false,
      message: "Use PDF, CSV, XLSX, or TXT for now.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = randomUUID();
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${organizationId}/${fileId}/${safeName}`;
  const fileType = inferFileType(file.name, mimeType);
  const { text: extractedText, processingStatus } = extractBusinessFileText(
    buffer,
    file.name,
    mimeType,
  );

  const answerEnabled =
    processingStatus === "ready" && Boolean(extractedText?.trim());

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUSINESS_FILES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data: row, error: insertError } = await admin
    .from("business_files")
    .insert({
      id: fileId,
      organization_id: organizationId,
      file_name: file.name,
      file_type: fileType,
      mime_type: mimeType,
      storage_path: storagePath,
      size_bytes: file.size,
      answer_enabled: answerEnabled,
      send_enabled: false,
      document_kind: documentKind,
      processing_status: processingStatus,
      extracted_text: extractedText,
    })
    .select(BUSINESS_FILE_SELECT)
    .single();

  if (insertError || !row) {
    await admin.storage.from(BUSINESS_FILES_BUCKET).remove([storagePath]);
    return { ok: false, message: insertError?.message ?? "Could not save file." };
  }

  return {
    ok: true,
    file: toBusinessFileListItem(
      mapBusinessFileRow(row as Parameters<typeof mapBusinessFileRow>[0]),
    ),
  };
}

export async function updateBusinessFileTogglesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  fileId: string,
  patch: { answerEnabled?: boolean; sendEnabled?: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existing, error: loadError } = await supabase
    .from("business_files")
    .select("answer_enabled, send_enabled, processing_status, extracted_text")
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: "File not found." };
  }

  let answerEnabled = existing.answer_enabled;
  let sendEnabled = existing.send_enabled;

  if (typeof patch.sendEnabled === "boolean") {
    if (patch.sendEnabled) {
      const canSend = Boolean(String(existing.extracted_text ?? "").trim());
      if (!canSend) {
        return {
          ok: false,
          message:
            "Cara can't send this file until she can read it. Try a text-based PDF, CSV, or TXT.",
        };
      }
    }
    sendEnabled = patch.sendEnabled;
  }
  if (typeof patch.answerEnabled === "boolean") {
    if (patch.answerEnabled) {
      const canAnswer =
        existing.processing_status === "ready" &&
        Boolean(String(existing.extracted_text ?? "").trim());
      if (!canAnswer) {
        return {
          ok: false,
          message:
            "This file is not ready for answering yet. TXT and CSV are supported for now; PDF and spreadsheets need processing.",
        };
      }
    }
    answerEnabled = patch.answerEnabled;
  }

  const { error } = await supabase
    .from("business_files")
    .update({
      answer_enabled: answerEnabled,
      send_enabled: sendEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileId)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, message: error.message };

  return { ok: true };
}

export async function deleteBusinessFileForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  fileId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existing, error: loadError } = await supabase
    .from("business_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: "File not found." };
  }

  const admin = createAdminClient();
  await admin.storage
    .from(BUSINESS_FILES_BUCKET)
    .remove([existing.storage_path as string]);

  const { error } = await supabase
    .from("business_files")
    .delete()
    .eq("id", fileId)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, message: error.message };

  return { ok: true };
}
