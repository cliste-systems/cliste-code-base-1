import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";

export type WarmTransferHardwareStatus =
  | "unknown"
  | "pending"
  | "go"
  | "blocked";

export type StoreTransferMethod = "sip_refer" | "dial_out" | "none";

export type TransferBlocker =
  | "routing_mode_would_loop"
  | "no_transfer_method"
  | "hardware_not_go"
  | "no_ddi_for_department"
  | "not_verified"
  | "ddi_range_unknown"
  | "no_ddi_range";

export type TransferCapability = {
  canTransfer: boolean;
  blockers: TransferBlocker[];
  perDepartment: Record<string, { canTransfer: boolean; target: string | null }>;
  fallbackBehaviour: "transfer" | "take_message";
};

export type StorePhoneSystemInput = {
  transfer_method?: StoreTransferMethod | string | null;
  warm_transfer_hardware_status?: WarmTransferHardwareStatus | string | null;
  transfer_verified_at?: string | null;
  has_ddi_range?: boolean | null;
  installer_contact?: string | null;
};

export type DepartmentTransferInput = Pick<
  StoreDepartmentRow,
  "id" | "name" | "active" | "extension" | "direct_dial_e164" | "phone_e164"
>;

function isValidE164(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  return /^\+[1-9][0-9]{6,14}$/.test(v);
}

function departmentDirectDial(dept: DepartmentTransferInput): string | null {
  const direct = dept.direct_dial_e164?.trim();
  if (isValidE164(direct)) return direct!;
  return null;
}

export function resolveTransferCapability(input: {
  callRoutingMode: CallRoutingMode | string | null | undefined;
  phoneSystem: StorePhoneSystemInput | null;
  departments: DepartmentTransferInput[];
}): TransferCapability {
  const mode = parseCallRoutingMode(input.callRoutingMode);
  const phone = input.phoneSystem;
  const transferMethod = (phone?.transfer_method ?? "none") as StoreTransferMethod;
  const hardwareStatus = (phone?.warm_transfer_hardware_status ??
    "unknown") as WarmTransferHardwareStatus;
  const hasDdiRange = phone?.has_ddi_range ?? null;
  const verified = Boolean(phone?.transfer_verified_at);

  const blockers: TransferBlocker[] = [];

  if (!callRoutingAllowsHumanTransfer(mode)) {
    blockers.push("routing_mode_would_loop");
  }
  if (transferMethod === "none") {
    blockers.push("no_transfer_method");
  }
  if (hardwareStatus !== "go") {
    blockers.push("hardware_not_go");
  }
  if (!verified) {
    blockers.push("not_verified");
  }
  if (hasDdiRange === null) {
    blockers.push("ddi_range_unknown");
  } else if (hasDdiRange === false) {
    blockers.push("no_ddi_range");
  }

  const storeLevelOk = blockers.length === 0;

  const perDepartment: TransferCapability["perDepartment"] = {};
  for (const dept of input.departments) {
    if (!dept.active) {
      perDepartment[dept.id] = { canTransfer: false, target: null };
      continue;
    }
    const target = departmentDirectDial(dept);
    const deptCanTransfer = storeLevelOk && Boolean(target);
    perDepartment[dept.id] = { canTransfer: deptCanTransfer, target };
  }

  const canTransfer =
    storeLevelOk &&
    Object.values(perDepartment).some((d) => d.canTransfer);

  return {
    canTransfer,
    blockers,
    perDepartment,
    fallbackBehaviour: storeLevelOk ? "transfer" : "take_message",
  };
}

/** @deprecated Use resolveTransferCapability().canTransfer */
export function canStoreTransfer(input: {
  warmTransferHardwareStatus: WarmTransferHardwareStatus;
  transferMethod: StoreTransferMethod;
  callRoutingMode: CallRoutingMode | string | null | undefined;
  transferVerifiedAt?: string | null;
  hasDdiRange?: boolean | null;
}): boolean {
  return resolveTransferCapability({
    callRoutingMode: input.callRoutingMode,
    phoneSystem: {
      transfer_method: input.transferMethod,
      warm_transfer_hardware_status: input.warmTransferHardwareStatus,
      transfer_verified_at: input.transferVerifiedAt ?? null,
      has_ddi_range: input.hasDdiRange ?? true,
    },
    departments: [],
  }).blockers.length === 0;
}

export type StorePhoneSystemRow = {
  organization_id: string;
  system_type: string;
  vendor: string | null;
  model: string | null;
  handset_count: number | null;
  installer_name: string | null;
  installer_contact: string | null;
  trunk_provider: string | null;
  has_ddi_range: boolean | null;
  ddi_pattern: string | null;
  transfer_method: StoreTransferMethod;
  warm_transfer_hardware_status: WarmTransferHardwareStatus;
  transfer_verified_at: string | null;
  transfer_verified_by: string | null;
  transfer_last_test_result: string | null;
  transfer_verification_pending: boolean;
  main_line_e164: string | null;
  notes: string | null;
};
