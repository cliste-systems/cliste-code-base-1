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

const DEPARTMENT_SELECT_FULL =
  "id, organization_id, name, phone_e164, hours, transfer_enabled, cara_note, sort_order, active, extension, handles_text, is_off_licence, is_an_post";
const DEPARTMENT_SELECT_LEGACY =
  "id, organization_id, name, phone_e164, hours, transfer_enabled, cara_note, sort_order, active";

function isSchemaCacheError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("column")
  );
}

function normalizeDepartmentRow(row: Record<string, unknown>): StoreDepartmentRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name ?? ""),
    phone_e164: (row.phone_e164 as string | null) ?? null,
    hours: (row.hours as Record<string, unknown> | null) ?? null,
    transfer_enabled: row.transfer_enabled === true,
    cara_note: (row.cara_note as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    active: row.active !== false,
    extension: (row.extension as string | null) ?? null,
    handles_text: (row.handles_text as string | null) ?? null,
    is_off_licence: row.is_off_licence === true,
    is_an_post: row.is_an_post === true,
  };
}

export async function loadStorePhoneSystem(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StorePhoneSystemRow | null> {
  const { data, error } = await supabase
    .from("store_phone_systems")
    .select(
      "organization_id, system_type, vendor, handset_count, transfer_method, warm_transfer_hardware_status, transfer_verified_at, main_line_e164, notes",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    if (isSchemaCacheError(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data?.organization_id) return null;
  return data as StorePhoneSystemRow;
}

export async function loadStoreDepartments(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StoreDepartmentRow[]> {
  const full = await supabase
    .from("store_departments")
    .select(DEPARTMENT_SELECT_FULL)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  if (!full.error) {
    return (full.data ?? []).map((row) =>
      normalizeDepartmentRow(row as Record<string, unknown>),
    );
  }

  if (!isSchemaCacheError(full.error.message)) {
    throw new Error(full.error.message);
  }

  const legacy = await supabase
    .from("store_departments")
    .select(DEPARTMENT_SELECT_LEGACY)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  if (legacy.error) {
    if (isSchemaCacheError(legacy.error.message)) return [];
    throw new Error(legacy.error.message);
  }

  return (legacy.data ?? []).map((row) =>
    normalizeDepartmentRow(row as Record<string, unknown>),
  );
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
