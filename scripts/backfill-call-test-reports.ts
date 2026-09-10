import { config } from "dotenv";

config({ path: ".env.local" });

import { persistCallTestReport } from "../src/lib/call-testing-persist";
import { TEST_LINE_E164 } from "../src/lib/call-testing-types";
import { createAdminClient } from "../src/utils/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: phoneRow } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", TEST_LINE_E164)
    .maybeSingle();

  const orgId = phoneRow?.organization_id as string | undefined;
  if (!orgId) {
    console.error("Test line not assigned");
    process.exit(1);
  }

  const { data: calls, error } = await admin
    .from("call_logs")
    .select("*")
    .eq("organization_id", orgId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let count = 0;
  for (const call of calls ?? []) {
    const result = await persistCallTestReport({
      admin,
      callLogId: call.id as string,
      orgId,
      body: {
        called_number: (call.called_number as string | null) || TEST_LINE_E164,
        caller_number: (call.caller_number as string) ?? "unknown",
        call_sid: (call.call_sid as string | null) ?? null,
        room_name: (call.room_name as string | null) ?? null,
        duration_seconds: (call.duration_seconds as number) ?? 0,
        transcript: (call.transcript as string | null) ?? null,
        transcript_review: (call.transcript_review as string | null) ?? null,
        ai_summary: (call.ai_summary as string | null) ?? null,
        cost_estimate: (call.cost_estimate as Record<string, unknown> | null) ?? null,
        disclosure_confirmed: call.disclosure_confirmed === true,
        created_at: (call.created_at as string) ?? null,
        variant_label: "Production default",
      },
    });
    if (result) {
      count += 1;
      console.log(call.id, result.healthStatus, result.healthReason);
    }
  }

  console.log(`Backfilled ${count} report(s)`);
}

void main();
