"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSessionUser } from "@/lib/admin-session";
import { reprocessCallLogPostCall } from "@/lib/post-call-reprocess";

export async function reprocessPostCallHealthRow(
  callLogId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await requireAdminSessionUser();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const id = callLogId.trim();
  if (!id) return { ok: false, message: "Call id required" };

  const result = await reprocessCallLogPostCall(id);
  if (!result.ok) return result;

  revalidatePath("/admin/post-call-health");
  revalidatePath("/admin");
  return { ok: true };
}
