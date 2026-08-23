import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseCallRoutingMode } from "@/lib/call-routing";
import {
  buildRetailPromptExtras,
  loadClisteTransferReadiness,
  loadStoreDepartments,
  loadStorePhoneSystem,
} from "@/lib/load-store-phone-system";
import { buildTransferVerdict } from "@/lib/transfer-capability-messages";

export async function loadTenantPhoneSetup(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const [{ data: org }, phoneSystem, departments, clisteReadiness] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, call_routing_mode")
        .eq("id", organizationId)
        .maybeSingle(),
      loadStorePhoneSystem(supabase, organizationId),
      loadStoreDepartments(supabase, organizationId),
      loadClisteTransferReadiness(supabase, organizationId),
    ]);

  const callRoutingMode = parseCallRoutingMode(org?.call_routing_mode);
  const { capability } = buildRetailPromptExtras({
    callRoutingMode,
    phoneSystem,
    departments,
  });

  const verdict = buildTransferVerdict({
    canTransfer: capability.canTransfer,
    blockers: capability.blockers,
    transferVerifiedAt: phoneSystem?.transfer_verified_at ?? null,
    transferVerificationPending: phoneSystem?.transfer_verification_pending ?? false,
  });

  const activeDepartments = departments
    .filter((d) => d.active)
    .map((d) => ({
      id: d.id,
      name: d.name,
      canTransfer: capability.perDepartment[d.id]?.canTransfer === true,
    }));

  return {
    storeName: String(org?.name ?? ""),
    phoneSystem,
    capability,
    verdict,
    activeDepartments,
    clisteReadiness,
    transferVerifiedAt: phoneSystem?.transfer_verified_at ?? null,
  };
}
