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
import { requireOnboardingSession } from "@/lib/onboarding-session";
import { createClient } from "@/utils/supabase/server";

type ActionResult = { ok: true } | { ok: false; message: string };

export async function listOnboardingBusinessFiles(): Promise<BusinessFileListItem[]> {
  const session = await requireOnboardingSession();
  const supabase = await createClient();
  return listBusinessFilesForOrg(supabase, session.organizationId);
}

export async function uploadOnboardingBusinessFile(
  formData: FormData,
): Promise<ActionResult & { file?: BusinessFileListItem }> {
  const session = await requireOnboardingSession();
  const file = formData.get("file");
  const rawKind = String(formData.get("documentKind") ?? "").trim();
  const documentKind = isBusinessFileKind(rawKind) ? rawKind : null;

  if (!(file instanceof File)) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const result = await uploadBusinessFileForOrg({
    organizationId: session.organizationId,
    file,
    documentKind,
  });

  if (result.ok) {
    revalidatePath("/onboarding/knowledge");
  }

  return result;
}

export async function updateOnboardingBusinessFileToggles(
  fileId: string,
  patch: { answerEnabled?: boolean; sendEnabled?: boolean },
): Promise<ActionResult> {
  const session = await requireOnboardingSession();
  const supabase = await createClient();
  const result = await updateBusinessFileTogglesForOrg(
    supabase,
    session.organizationId,
    fileId,
    patch,
  );
  if (result.ok) revalidatePath("/onboarding/knowledge");
  return result;
}

export async function deleteOnboardingBusinessFile(
  fileId: string,
): Promise<ActionResult> {
  const session = await requireOnboardingSession();
  const supabase = await createClient();
  const result = await deleteBusinessFileForOrg(
    supabase,
    session.organizationId,
    fileId,
  );
  if (result.ok) revalidatePath("/onboarding/knowledge");
  return result;
}
