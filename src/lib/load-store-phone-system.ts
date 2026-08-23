import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveTransferCapability,
  type StorePhoneSystemRow,
  type StoreTransferMethod,
  type TransferCapability,
  type WarmTransferHardwareStatus,
} from "@/lib/transfer-capability";
import { storeDepartmentsPromptSection } from "@/lib/store-departments-prompt";
import { retailBoundaryPromptLines } from "@/lib/retail-prompt-boundaries";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";
import { parseCallRoutingMode } from "@/lib/call-routing";

const PHONE_SYSTEM_SELECT =
  "organization_id, system_type, vendor, model, handset_count, installer_name, installer_contact, trunk_provider, has_ddi_range, ddi_pattern, transfer_method, warm_transfer_hardware_status, transfer_verified_at, transfer_verified_by, transfer_last_test_result, transfer_verification_pending, main_line_e164, notes";

const PHONE_SYSTEM_SELECT_LEGACY =
  "organization_id, system_type, vendor, handset_count, transfer_method, warm_transfer_hardware_status, transfer_verified_at, main_line_e164, notes";

const DEPARTMENT_SELECT_FULL =
  "id, organization_id, name, phone_e164, direct_dial_e164, hours, transfer_enabled, cara_note, sort_order, active, extension, handles_text, contact_email, manager_name, is_off_licence, is_an_post";
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
    direct_dial_e164: (row.direct_dial_e164 as string | null) ?? null,
    hours: (row.hours as Record<string, unknown> | null) ?? null,
    transfer_enabled: row.transfer_enabled === true,
    cara_note: (row.cara_note as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    active: row.active !== false,
    extension: (row.extension as string | null) ?? null,
    handles_text: (row.handles_text as string | null) ?? null,
    contact_email: (row.contact_email as string | null) ?? null,
    manager_name: (row.manager_name as string | null) ?? null,
    is_off_licence: row.is_off_licence === true,
    is_an_post: row.is_an_post === true,
  };
}

function normalizePhoneSystemRow(row: Record<string, unknown>): StorePhoneSystemRow {
  return {
    organization_id: String(row.organization_id),
    system_type: String(row.system_type ?? "unknown"),
    vendor: (row.vendor as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    handset_count:
      row.handset_count == null ? null : Number(row.handset_count),
    installer_name: (row.installer_name as string | null) ?? null,
    installer_contact: (row.installer_contact as string | null) ?? null,
    trunk_provider: (row.trunk_provider as string | null) ?? null,
    has_ddi_range:
      row.has_ddi_range === true
        ? true
        : row.has_ddi_range === false
          ? false
          : null,
    ddi_pattern: (row.ddi_pattern as string | null) ?? null,
    transfer_method: (row.transfer_method as StoreTransferMethod) ?? "none",
    warm_transfer_hardware_status:
      (row.warm_transfer_hardware_status as WarmTransferHardwareStatus) ??
      "unknown",
    transfer_verified_at: (row.transfer_verified_at as string | null) ?? null,
    transfer_verified_by: (row.transfer_verified_by as string | null) ?? null,
    transfer_last_test_result:
      (row.transfer_last_test_result as string | null) ?? null,
    transfer_verification_pending: row.transfer_verification_pending === true,
    main_line_e164: (row.main_line_e164 as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

export async function loadStorePhoneSystem(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StorePhoneSystemRow | null> {
  const full = await supabase
    .from("store_phone_systems")
    .select(PHONE_SYSTEM_SELECT)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!full.error && full.data?.organization_id) {
    return normalizePhoneSystemRow(full.data as Record<string, unknown>);
  }

  if (full.error && !isSchemaCacheError(full.error.message)) {
    throw new Error(full.error.message);
  }

  const legacy = await supabase
    .from("store_phone_systems")
    .select(PHONE_SYSTEM_SELECT_LEGACY)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (legacy.error) {
    if (isSchemaCacheError(legacy.error.message)) return null;
    throw new Error(legacy.error.message);
  }
  if (!legacy.data?.organization_id) return null;
  return normalizePhoneSystemRow(legacy.data as Record<string, unknown>);
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
  capability: TransferCapability;
  storeDepartmentsSection: string;
  retailBoundaryLines: string[];
} {
  const capability = resolveTransferCapability({
    callRoutingMode: parseCallRoutingMode(input.callRoutingMode),
    phoneSystem: input.phoneSystem,
    departments: input.departments,
  });

  return {
    canTransfer: capability.canTransfer,
    capability,
    storeDepartmentsSection: storeDepartmentsPromptSection({
      capability,
      departments: input.departments,
    }),
    retailBoundaryLines: retailBoundaryPromptLines({}),
  };
}

export type ClisteTransferReadiness = {
  clisteNumber: string | null;
  sipReferLikelyEnabled: boolean;
  detail: string;
};

export async function loadClisteTransferReadiness(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ClisteTransferReadiness> {
  const { data: phone } = await supabase
    .from("phone_numbers")
    .select("e164, livekit_sip_trunk_id, provider")
    .eq("organization_id", organizationId)
    .eq("status", "assigned")
    .maybeSingle();

  const clisteNumber = phone?.e164 ? String(phone.e164) : null;
  const hasSipTrunk = Boolean(phone?.livekit_sip_trunk_id);
  const voiceUrl = process.env.TWILIO_IE_VOICE_URL?.trim();

  const sipReferLikelyEnabled = Boolean(hasSipTrunk && voiceUrl);
  const detail = sipReferLikelyEnabled
    ? "Cliste number is on SIP ingress — Call Transfer (SIP REFER) should be enabled on the Twilio/LiveKit trunk for this DID."
    : clisteNumber
      ? "This org uses a programmable-voice number. Elastic SIP Trunking with REFER may be required before live transfers work — check ops runbook."
      : "No Cliste number assigned yet.";

  return { clisteNumber, sipReferLikelyEnabled, detail };
}
