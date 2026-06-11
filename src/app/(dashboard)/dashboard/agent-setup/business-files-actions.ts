"use server";

import { revalidatePath } from "next/cache";

import {
  deleteBusinessFileForOrg,
  listBusinessFilesForOrg,
  updateBusinessFileTogglesForOrg,
  uploadBusinessFileForOrg,
} from "@/lib/business-files-server";
import {
  isBusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { requireDashboardSession } from "@/lib/dashboard-session";

type ActionResult = { ok: true } | { ok: false; message: string };

function revalidateBusinessFilesPaths() {
  revalidatePath("/dashboard/cara-setup");
  revalidatePath("/dashboard/cara-setup");
  revalidatePath("/dashboard/cara-setup/answers");
  revalidatePath("/dashboard/routing");
  revalidatePath("/onboarding/knowledge");
}

export async function listBusinessFiles(): Promise<BusinessFileListItem[]> {
  const { supabase, organizationId } = await requireDashboardSession();
  return listBusinessFilesForOrg(supabase, organizationId);
}

export async function listSendableBusinessFiles(): Promise<BusinessFileListItem[]> {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data, error } = await supabase
    .from("business_files")
    .select(
      "id, organization_id, file_name, file_type, mime_type, storage_path, size_bytes, answer_enabled, send_enabled, document_kind, processing_status, extracted_text, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("send_enabled", true)
    .order("file_name", { ascending: true });

  if (error || !data) return [];
  const { mapBusinessFileRow, toBusinessFileListItem } = await import(
    "@/lib/business-files"
  );
  return data.map((row) =>
    toBusinessFileListItem(
      mapBusinessFileRow(row as Parameters<typeof mapBusinessFileRow>[0]),
    ),
  );
}

export async function uploadBusinessFile(
  formData: FormData,
): Promise<ActionResult & { file?: BusinessFileListItem }> {
  const { organizationId, supabase } = await requireDashboardSession();
  const file = formData.get("file");
  const rawKind = String(formData.get("documentKind") ?? "").trim();
  const documentKind = isBusinessFileKind(rawKind) ? rawKind : null;

  if (!(file instanceof File)) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const result = await uploadBusinessFileForOrg({
    organizationId,
    file,
    documentKind,
  });

  if (result.ok) {
    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateBusinessFilesPaths();
  }

  return result;
}

export async function updateBusinessFileToggles(
  fileId: string,
  patch: { answerEnabled?: boolean; sendEnabled?: boolean },
): Promise<ActionResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const result = await updateBusinessFileTogglesForOrg(
    supabase,
    organizationId,
    fileId,
    patch,
  );
  if (result.ok) {
    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateBusinessFilesPaths();
  }
  return result;
}

export async function deleteBusinessFile(fileId: string): Promise<ActionResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const result = await deleteBusinessFileForOrg(
    supabase,
    organizationId,
    fileId,
  );
  if (result.ok) {
    await regenerateCaraCustomPrompt(supabase, organizationId);
    revalidateBusinessFilesPaths();
  }
  return result;
}
