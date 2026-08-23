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

export function transferCapabilityVerdict(canTransfer: boolean): {
  headline: string;
  detail: string;
} {
  if (canTransfer) {
    return {
      headline: "Cara can put callers through",
      detail: "Transfer hardware is verified and routing allows human handoff.",
    };
  }
  return {
    headline: "Cara will take messages — transfers are not available on this setup",
    detail:
      "Check phone system status, transfer method, and call routing mode before expecting live transfers.",
  };
}

export function routingTransferConflict(input: {
  callRoutingMode: CallRoutingMode | string | null | undefined;
  departmentsWithTransferTargets: number;
}): { hasConflict: boolean; message: string; fixes: string[] } {
  const mode = parseCallRoutingMode(input.callRoutingMode);
  if (
    callRoutingAllowsHumanTransfer(mode) ||
    input.departmentsWithTransferTargets === 0
  ) {
    return { hasConflict: false, message: "", fixes: [] };
  }
  return {
    hasConflict: true,
    message:
      "This store uses carrier divert (forward all or missed). Transferring callers back to the store line would loop, so Cara takes messages instead of putting callers through.",
    fixes: [
      "Switch call routing to “Use your new Cliste number” so Cara can transfer safely.",
      "Or deliver the Cliste DID as a SIP trunk into the store PBX so transfers stay inside the phone system.",
    ],
  };
}
