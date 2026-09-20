import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isEngineerTestCallRow } from "@/lib/engineer-test-call";

/** True when a training item originated from an engineer test session. */
export async function trainingItemFromEngineerTest(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<boolean> {
  const { data: item } = await supabase
    .from("cara_training_items")
    .select("call_log_id, action_ticket_id")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!item) return false;

  const callLogId = item.call_log_id as string | null;
  if (callLogId) {
    const { data: callLog } = await supabase
      .from("call_logs")
      .select("engineer_test_call, caller_number, room_name")
      .eq("id", callLogId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (isEngineerTestCallRow(callLog ?? {})) return true;
  }

  const ticketId = item.action_ticket_id as string | null;
  if (ticketId) {
    const { data: ticket } = await supabase
      .from("action_tickets")
      .select("engineer_test_call, caller_number")
      .eq("id", ticketId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (isEngineerTestCallRow(ticket ?? {})) return true;
  }

  return false;
}
