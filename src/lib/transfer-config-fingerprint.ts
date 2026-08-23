import { createHash } from "node:crypto";

import type { CallRoutingMode } from "@/lib/call-routing";
import type { DepartmentTransferInput } from "@/lib/transfer-capability";

export function buildTransferConfigFingerprint(input: {
  callRoutingMode: CallRoutingMode | string;
  transferMethod: string;
  hasDdiRange: boolean | null;
  departments: Pick<DepartmentTransferInput, "id" | "direct_dial_e164">[];
}): string {
  const normalized = {
    callRoutingMode: String(input.callRoutingMode),
    transferMethod: String(input.transferMethod),
    hasDdiRange: input.hasDdiRange,
    departments: [...input.departments]
      .map((d) => ({
        id: d.id,
        direct_dial_e164: d.direct_dial_e164?.trim() || null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
