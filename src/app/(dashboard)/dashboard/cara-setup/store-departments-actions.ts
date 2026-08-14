"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  type StoreDepartmentDraft,
} from "@/lib/store-departments";
import { replaceStoreDepartments } from "@/lib/store-departments-server";

export type SaveStoreDepartmentsResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveStoreDepartments(
  drafts: StoreDepartmentDraft[],
): Promise<SaveStoreDepartmentsResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const result = await replaceStoreDepartments(supabase, organizationId, drafts);
  if (!result.ok) return result;
  revalidatePath(DASHBOARD_ROUTES.setup);
  revalidatePath("/dashboard");
  return { ok: true };
}
