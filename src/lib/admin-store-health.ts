import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";

export const WARM_TRANSFER_HARDWARE_STATUSES = [
  "go",
  "no_go",
  "unknown",
] as const;

export type WarmTransferHardwareStatus =
  (typeof WARM_TRANSFER_HARDWARE_STATUSES)[number];

export function isWarmTransferHardwareStatus(
  value: unknown,
): value is WarmTransferHardwareStatus {
  return (
    typeof value === "string" &&
    (WARM_TRANSFER_HARDWARE_STATUSES as readonly string[]).includes(value)
  );
}

export function parseWarmTransferHardwareStatus(
  raw: unknown,
): WarmTransferHardwareStatus {
  return isWarmTransferHardwareStatus(raw) ? raw : "unknown";
}

export type StoreHealthCheckId =
  | "did"
  | "hours"
  | "faqs"
  | "departments"
  | "transfer"
  | "routing"
  | "hardware";

export type StoreHealthCheck = {
  id: StoreHealthCheckId;
  label: string;
  ok: boolean;
  detail: string;
};

export type WarmTransferGoNoGo = {
  ready: boolean;
  label: "Go" | "No-go";
  reasons: string[];
};

export type StoreHealthInput = {
  phoneNumber: string | null | undefined;
  hoursConfigured: boolean;
  faqCount: number;
  departmentCount: number;
  transferNumber: string | null | undefined;
  callRoutingMode: CallRoutingMode | string | null | undefined;
  hardwareStatus: WarmTransferHardwareStatus;
  openLearnableGaps: number;
  lastCallAt: string | null;
};

export type StoreHealth = {
  checks: StoreHealthCheck[];
  readyCount: number;
  warmTransfer: WarmTransferGoNoGo;
  openLearnableGaps: number;
  lastCallAt: string | null;
};

export function evaluateStoreHealth(input: StoreHealthInput): StoreHealth {
  const did = String(input.phoneNumber ?? "").trim();
  const transfer = String(input.transferNumber ?? "").trim();
  const mode = parseCallRoutingMode(input.callRoutingMode);
  const allowsTransfer = callRoutingAllowsHumanTransfer(mode);
  const hardware = parseWarmTransferHardwareStatus(input.hardwareStatus);

  const checks: StoreHealthCheck[] = [
    {
      id: "did",
      label: "Irish DID",
      ok: Boolean(did),
      detail: did || "No Cliste number assigned",
    },
    {
      id: "hours",
      label: "Opening hours",
      ok: input.hoursConfigured,
      detail: input.hoursConfigured ? "Configured" : "Not set",
    },
    {
      id: "faqs",
      label: "FAQs",
      ok: input.faqCount > 0,
      detail:
        input.faqCount > 0
          ? `${input.faqCount} saved`
          : "None yet",
    },
    {
      id: "departments",
      label: "Departments",
      ok: input.departmentCount > 0,
      detail:
        input.departmentCount > 0
          ? `${input.departmentCount} saved`
          : "None yet",
    },
    {
      id: "routing",
      label: "Call routing",
      ok: allowsTransfer,
      detail: allowsTransfer
        ? "Cliste number — warm transfer allowed"
        : "Forwarding mode — transferring back would loop",
    },
    {
      id: "transfer",
      label: "Human transfer number",
      ok: allowsTransfer && Boolean(transfer),
      detail: transfer
        ? transfer
        : allowsTransfer
          ? "Not set"
          : "Not used in this routing mode",
    },
    {
      id: "hardware",
      label: "Handset / PBX warm transfer",
      ok: hardware === "go",
      detail:
        hardware === "go"
          ? "Go — store can hold, enquire, and transfer"
          : hardware === "no_go"
            ? "No-go — hardware cannot warm-transfer"
            : "Not checked yet",
    },
  ];

  const reasons: string[] = [];
  if (!did) reasons.push("No Irish DID assigned.");
  if (!allowsTransfer) {
    reasons.push("Routing mode cannot warm-transfer without looping.");
  }
  if (allowsTransfer && !transfer) {
    reasons.push("No human transfer number on file.");
  }
  if (hardware === "no_go") {
    reasons.push("Hardware marked no-go.");
  }
  if (hardware === "unknown") {
    reasons.push("Hardware not checked yet.");
  }

  const ready = reasons.length === 0;
  return {
    checks,
    readyCount: checks.filter((c) => c.ok).length,
    warmTransfer: {
      ready,
      label: ready ? "Go" : "No-go",
      reasons,
    },
    openLearnableGaps: input.openLearnableGaps,
    lastCallAt: input.lastCallAt,
  };
}
