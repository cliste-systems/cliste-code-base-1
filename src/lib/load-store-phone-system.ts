import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canStoreTransfer,
  type StorePhoneSystemRow,
  type StoreTransferMethod,
  type WarmTransferHardwareStatus,
} from "@/lib/store-transfer-capability";
import { storeDepartmentsPromptSection } from "@/lib/store-departments-prompt";
import { retailBoundaryPromptLines } from "@/lib/retail-prompt-boundaries";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";
import { parseCallRoutingMode } from "@/lib/call-routing";

export async function loadStorePhoneSystem(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StorePhoneSystemRow | null> {
  const { data } = await supabase
    .from("store_phone_systems")
    .select(
      "organization_id, system_type, vendor, handset_count, transfer_method, warm_transfer_hardware_status, transfer_verified_at, main_line_e164, notes",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data?.organization_id) return null;
  return data as StorePhoneSystemRow;
}

export async function loadStoreDepartments(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StoreDepartmentRow[]> {
  const { data } = await supabase
    .from("store_departments")
    .select(
      "id, organization_id, name, phone_e164, hours, transfer_enabled, cara_note, sort_order, active, extension, handles_text, is_off_licence, is_an_post",
    )
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  return (data ?? []) as StoreDepartmentRow[];
}

export function buildRetailPromptExtras(input: {
  callRoutingMode: unknown;
  phoneSystem: StorePhoneSystemRow | null;
  departments: StoreDepartmentRow[];
}): {
  canTransfer: boolean;
  storeDepartmentsSection: string;
  retailBoundaryLines: string[];
} {
  const canTransfer = canStoreTransfer({
    warmTransferHardwareStatus:
      (input.phoneSystem?.warm_transfer_hardware_status as WarmTransferHardwareStatus) ??
      "unknown",
    transferMethod:
      (input.phoneSystem?.transfer_method as StoreTransferMethod) ?? "none",
    callRoutingMode: parseCallRoutingMode(input.callRoutingMode),
  });

  return {
    canTransfer,
    storeDepartmentsSection: storeDepartmentsPromptSection({
      canTransfer,
      departments: input.departments,
    }),
    retailBoundaryLines: retailBoundaryPromptLines({}),
  };
}
