import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function invalidateStoreTransferVerification(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const { error } = await supabase.rpc("invalidate_store_transfer_verification", {
    p_org_id: organizationId,
  });
  if (error) throw new Error(error.message);
}

export async function setStoreTransferVerificationPending(
  supabase: SupabaseClient,
  organizationId: string,
  pending: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_store_transfer_verification_pending", {
    p_org_id: organizationId,
    p_pending: pending,
  });
  if (error) throw new Error(error.message);
}

export async function stampStoreTransferVerified(
  supabase: SupabaseClient,
  organizationId: string,
  result: string,
): Promise<void> {
  const { error } = await supabase.rpc("stamp_store_transfer_verified", {
    p_org_id: organizationId,
    p_result: result,
  });
  if (error) throw new Error(error.message);
}
