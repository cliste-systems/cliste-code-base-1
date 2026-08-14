import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  departmentFromRow,
  departmentNames,
  MAX_DEPARTMENT_NAME_LENGTH,
  MAX_DEPARTMENT_TRANSFER_LENGTH,
  MAX_STORE_DEPARTMENTS,
  serializeDepartmentHours,
  type StoreDepartment,
  type StoreDepartmentDraft,
} from "@/lib/store-departments";

export async function listStoreDepartments(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StoreDepartment[]> {
  const { data, error } = await supabase
    .from("store_departments")
    .select(
      "id, organization_id, name, uses_store_hours, hours, transfer_number, is_off_licence, is_an_post, sort_order",
    )
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[store-departments] list", error.message);
    return [];
  }
  return (data ?? []).map((row) => departmentFromRow(row as Record<string, unknown>));
}

export type ReplaceStoreDepartmentsResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Replace the store's department rows, keep chip text in sync, recompile Cara.
 * Always scoped to organizationId — never accept a client-supplied org on a row.
 */
export async function replaceStoreDepartments(
  supabase: SupabaseClient,
  organizationId: string,
  drafts: StoreDepartmentDraft[],
): Promise<ReplaceStoreDepartmentsResult> {
  const cleaned: StoreDepartmentDraft[] = [];
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) continue;
    if (name.length > MAX_DEPARTMENT_NAME_LENGTH) {
      return {
        ok: false,
        message: `Department names must be ${MAX_DEPARTMENT_NAME_LENGTH} characters or fewer.`,
      };
    }
    const transferNumber = draft.transferNumber.trim();
    if (transferNumber.length > MAX_DEPARTMENT_TRANSFER_LENGTH) {
      return { ok: false, message: "A department transfer number looks too long." };
    }
    cleaned.push({
      ...draft,
      name,
      transferNumber,
    });
  }

  if (cleaned.length > MAX_STORE_DEPARTMENTS) {
    return {
      ok: false,
      message: `You can save up to ${MAX_STORE_DEPARTMENTS} departments.`,
    };
  }

  const { error: delErr } = await supabase
    .from("store_departments")
    .delete()
    .eq("organization_id", organizationId);

  if (delErr) {
    return { ok: false, message: delErr.message };
  }

  if (cleaned.length > 0) {
    const { error: insErr } = await supabase.from("store_departments").insert(
      cleaned.map((d, i) => ({
        organization_id: organizationId,
        name: d.name,
        uses_store_hours: d.usesStoreHours,
        hours: d.usesStoreHours ? null : serializeDepartmentHours(d.hours),
        transfer_number: d.transferNumber || null,
        is_off_licence: d.isOffLicence,
        is_an_post: d.isAnPost,
        sort_order: i,
      })),
    );
    if (insErr) {
      return { ok: false, message: insErr.message };
    }
  }

  const names = departmentNames(cleaned);
  const { error: orgErr } = await supabase
    .from("organizations")
    .update({
      agent_services_departments: formatAgentKnowledgeList(names),
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (orgErr) {
    return { ok: false, message: orgErr.message };
  }

  return { ok: true };
}
