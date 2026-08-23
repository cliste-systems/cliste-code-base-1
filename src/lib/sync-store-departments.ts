import type { SupabaseClient } from "@supabase/supabase-js";

import { mergeRetailRoutingLinks } from "@/lib/sync-department-routes";
import { syncAgentServicesDepartmentsFromStore } from "@/lib/store-departments";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { AGENT_CONFIG_REVALIDATE_PATHS } from "@/lib/dashboard-routes";
import { revalidatePath } from "next/cache";

export async function syncStoreDepartmentsToOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: org } = await admin
    .from("organizations")
    .select("routing_links, retail_click_collect_url")
    .eq("id", organizationId)
    .maybeSingle();

  const { data: departments } = await admin
    .from("store_departments")
    .select(
      "id, organization_id, name, phone_e164, hours, transfer_enabled, cara_note, sort_order, active, extension, handles_text, is_off_licence, is_an_post",
    )
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  const deptRows = (departments ?? []) as StoreDepartmentRow[];
  const merged = mergeRetailRoutingLinks({
    departments: deptRows,
    existingLinks: org?.routing_links,
    clickCollectUrl: String(org?.retail_click_collect_url ?? ""),
  });

  const agentServices = syncAgentServicesDepartmentsFromStore(deptRows);

  const { error } = await admin
    .from("organizations")
    .update({
      routing_links: merged,
      agent_services_departments: agentServices || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function revalidateCaraTrainingPaths(orgId: string) {
  revalidatePath(`/admin/customers/${orgId}`);
  revalidatePath(`/admin/customers/${orgId}/cara-training`);
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath(`/admin/organizations/${orgId}/cara-training`);
  revalidatePath("/admin/customers");
  for (const path of AGENT_CONFIG_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function finalizeCaraTrainingSave(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const regen = await regenerateCaraCustomPrompt(admin, organizationId);
  if (!regen.ok) return regen;
  revalidateCaraTrainingPaths(organizationId);
  return { ok: true };
}
