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
import { shouldDefaultAnswerEnabledOff } from "@/lib/knowledge-precedence";
import {
  BUSINESS_FILE_SELECT,
  BUSINESS_FILE_SELECT_LEGACY,
  businessFileSelectColumns,
  isMissingBusinessFileMetadataColumnError,
  markBusinessFileMetadataColumnsAvailable,
  markBusinessFileMetadataColumnsUnavailable,
  businessFileMetadataColumnsAvailable,
} from "@/lib/business-files-select";
import {
  databaseUpdateRequiredMessage,
  isMissingPostgresColumn,
} from "@/lib/supabase-errors";
import { createAdminClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  BUSINESS_FILE_SELECT,
  BUSINESS_FILE_SELECT_LEGACY,
  businessFileSelectColumns,
} from "@/lib/business-files-select";

async function selectBusinessFilesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { sendEnabledOnly?: boolean; orderByName?: boolean },
) {
  const runQuery = (select: string) => {
    let query = supabase
      .from("business_files")
      .select(select)
      .eq("organization_id", organizationId);

    if (options?.sendEnabledOnly) {
      query = query.eq("send_enabled", true);
    }

    if (options?.orderByName) {
      query = query.order("file_name", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    return query;
  };

  if (businessFileMetadataColumnsAvailable() === false) {
    return runQuery(BUSINESS_FILE_SELECT_LEGACY);
  }

  const result = await runQuery(BUSINESS_FILE_SELECT);
  if (
    result.error &&
    isMissingBusinessFileMetadataColumnError(result.error.message)
  ) {
    markBusinessFileMetadataColumnsUnavailable();
    return runQuery(BUSINESS_FILE_SELECT_LEGACY);
  }

  if (!result.error) {
    markBusinessFileMetadataColumnsAvailable();
  }

  return result;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()+\s]/g, "_").slice(0, 180) || "document";
}

export async function listBusinessFilesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<BusinessFileListItem[]> {
  const { data, error } = await selectBusinessFilesForOrg(
    supabase,
    organizationId,
  );

  if (error || !data) return [];
  return (data as unknown[]).map((row) =>
    toBusinessFileListItem(
      mapBusinessFileRow(
        row as unknown as Parameters<typeof mapBusinessFileRow>[0],
      ),
    ),
  );
}

export async function listSendableBusinessFilesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<BusinessFileListItem[]> {
  const { data, error } = await selectBusinessFilesForOrg(
    supabase,
    organizationId,
    { sendEnabledOnly: true, orderByName: true },
  );

  if (error || !data) return [];
  return (data as unknown[]).map((row) =>
    toBusinessFileListItem(
      mapBusinessFileRow(
        row as unknown as Parameters<typeof mapBusinessFileRow>[0],
      ),
    ),
  );
}

export async function uploadBusinessFileForOrg(input: {
  organizationId: string;
  file: File;
  documentKind?: BusinessFileKind | null;
  hasServiceCatalog?: boolean;
  hasFaqs?: boolean;
}): Promise<
  { ok: true; file: BusinessFileListItem; overlapSendOnlyDefault?: boolean } | { ok: false; message: string }
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
  if (!documentKind) {
    return { ok: false, message: "Choose a document type before uploading." };
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
  const { text: extractedText, processingStatus } = await extractBusinessFileText(
    buffer,
    file.name,
    mimeType,
  );

  const couldAnswer =
    processingStatus === "ready" && Boolean(extractedText?.trim());
  const overlapSendOnlyDefault = shouldDefaultAnswerEnabledOff({
    documentKind,
    hasServiceCatalog: input.hasServiceCatalog === true,
    hasFaqs: input.hasFaqs === true,
    processingStatus,
    hasExtractedText: Boolean(extractedText?.trim()),
  });
  const answerEnabled = couldAnswer && !overlapSendOnlyDefault;

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

  const insertPayload = {
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
  };

  let { data: row, error: insertError } = await admin
    .from("business_files")
    .insert(insertPayload)
    .select(businessFileSelectColumns())
    .single();

  if (
    insertError &&
    isMissingBusinessFileMetadataColumnError(insertError.message) &&
    businessFileMetadataColumnsAvailable() !== false
  ) {
    markBusinessFileMetadataColumnsUnavailable();
    ({ data: row, error: insertError } = await admin
      .from("business_files")
      .insert(insertPayload)
      .select(BUSINESS_FILE_SELECT_LEGACY)
      .single());
  }

  if (insertError || !row) {
    await admin.storage.from(BUSINESS_FILES_BUCKET).remove([storagePath]);
    return { ok: false, message: insertError?.message ?? "Could not save file." };
  }

  return {
    ok: true,
    file: toBusinessFileListItem(
      mapBusinessFileRow(
        row as unknown as Parameters<typeof mapBusinessFileRow>[0],
      ),
    ),
    overlapSendOnlyDefault: overlapSendOnlyDefault || undefined,
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
            "Cara couldn't read text from this file. Try a text-based PDF, CSV, or TXT.",
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

const MAX_FILE_TITLE_CHARS = 120;
const MAX_FILE_DESCRIPTION_CHARS = 500;
const MAX_FILE_WHEN_TO_USE_CHARS = 300;

export async function updateBusinessFileMetadataForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  fileId: string,
  patch: {
    title?: string;
    documentKind?: BusinessFileKind;
    caraDescription?: string;
    whenToUse?: string;
  },
): Promise<{ ok: true; file: BusinessFileListItem } | { ok: false; message: string }> {
  const title = patch.title?.trim() ?? "";
  const caraDescription = patch.caraDescription?.trim() ?? "";
  const whenToUse = patch.whenToUse?.trim() ?? "";
  const documentKind =
    patch.documentKind && isBusinessFileKind(patch.documentKind)
      ? patch.documentKind
      : null;

  if (!documentKind) {
    return { ok: false, message: "Choose what type of document this is." };
  }
  if (!title) {
    return { ok: false, message: "Add a title for this file." };
  }
  if (title.length > MAX_FILE_TITLE_CHARS) {
    return {
      ok: false,
      message: `Title must be at most ${MAX_FILE_TITLE_CHARS} characters.`,
    };
  }
  if (caraDescription.length > MAX_FILE_DESCRIPTION_CHARS) {
    return {
      ok: false,
      message: `Description must be at most ${MAX_FILE_DESCRIPTION_CHARS} characters.`,
    };
  }
  if (whenToUse.length > MAX_FILE_WHEN_TO_USE_CHARS) {
    return {
      ok: false,
      message: `When to use must be at most ${MAX_FILE_WHEN_TO_USE_CHARS} characters.`,
    };
  }

  if (businessFileMetadataColumnsAvailable() === false) {
    return {
      ok: false,
      message: databaseUpdateRequiredMessage("business_files.title"),
    };
  }

  const { data, error } = await supabase
    .from("business_files")
    .update({
      title,
      document_kind: documentKind,
      cara_description: caraDescription || null,
      when_to_use: whenToUse || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .select(BUSINESS_FILE_SELECT)
    .maybeSingle();

  if (error) {
    if (
      isMissingPostgresColumn(error, "title") ||
      isMissingBusinessFileMetadataColumnError(error.message)
    ) {
      markBusinessFileMetadataColumnsUnavailable();
      return {
        ok: false,
        message: databaseUpdateRequiredMessage("business_files.title"),
      };
    }
    return { ok: false, message: error.message };
  }
  if (!data) return { ok: false, message: "File not found." };

  return {
    ok: true,
    file: toBusinessFileListItem(
      mapBusinessFileRow(
        data as unknown as Parameters<typeof mapBusinessFileRow>[0],
      ),
    ),
  };
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
