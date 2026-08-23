"use client";

import {
  routingTransferConflict,
  transferCapabilityVerdict,
} from "@/lib/store-transfer-capability";
import { parseCallRoutingMode } from "@/lib/call-routing";

export function TransferCapabilityBanner({
  callRoutingMode,
  canTransfer,
  departmentsWithTransferTargets,
}: {
  callRoutingMode: string | null | undefined;
  canTransfer: boolean;
  departmentsWithTransferTargets: number;
}) {
  const verdict = transferCapabilityVerdict(canTransfer);
  const conflict = routingTransferConflict({
    callRoutingMode: parseCallRoutingMode(callRoutingMode),
    departmentsWithTransferTargets,
  });

  return (
    <div
      className={
        canTransfer
          ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      }
      role="status"
    >
      <p className="font-semibold">{verdict.headline}</p>
      <p className="mt-1 text-xs opacity-90">{verdict.detail}</p>
      {conflict.hasConflict ? (
        <div className="mt-3 border-t border-amber-200/80 pt-3">
          <p className="font-medium">{conflict.message}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {conflict.fixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
