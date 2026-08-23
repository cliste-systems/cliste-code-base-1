import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";

export type WarmTransferHardwareStatus =
  | "unknown"
  | "pending"
  | "go"
  | "blocked";

export type StoreTransferMethod = "sip_refer" | "dial_out" | "none";

export type StorePhoneSystemRow = {
  organization_id: string;
  system_type: string;
  vendor: string | null;
  handset_count: number | null;
  transfer_method: StoreTransferMethod;
  warm_transfer_hardware_status: WarmTransferHardwareStatus;
  transfer_verified_at: string | null;
  main_line_e164: string | null;
  notes: string | null;
};

export function canStoreTransfer(input: {
  warmTransferHardwareStatus: WarmTransferHardwareStatus;
  transferMethod: StoreTransferMethod;
  callRoutingMode: CallRoutingMode | string | null | undefined;
}): boolean {
  const mode = parseCallRoutingMode(input.callRoutingMode);
  return (
    input.warmTransferHardwareStatus === "go" &&
    input.transferMethod !== "none" &&
    callRoutingAllowsHumanTransfer(mode)
  );
}
